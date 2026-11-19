import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  RawBodyRequest,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { InvoicePdfService } from '@autoclipr/emails';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { Request } from 'express';
import { ApiResponse } from '../../common/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard, AuthUser } from '../../common/guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { DodoService } from './dodo.service';
import { CANCELLATION_REASONS, SubscriptionsService } from './subscriptions.service';

class CreateCheckoutDto {
  @IsString()
  planId!: string;

  @IsString()
  billingPeriod?: 'monthly' | 'yearly';

  /** Optional coupon. Re-validated server-side before the checkout is built. */
  @IsOptional()
  @IsString()
  @Length(3, 16)
  couponCode?: string;

  /** Buyer's country from IP geolocation; only prefills Dodo's checkout. */
  @IsOptional()
  @Matches(/^[A-Za-z]{2}$/)
  country?: string;
}

class ActivatePlanDto {
  @IsString()
  planId!: string;

  @IsString()
  transactionId?: string;

  @IsString()
  billingPeriod?: 'monthly' | 'yearly';
}

class CancelSubscriptionDto {
  /** Optional "why are you leaving" answer. */
  @IsOptional()
  @IsIn(Object.keys(CANCELLATION_REASONS))
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

@ApiTags('Billing')
@Controller()
export class BillingController {
  constructor(
    private readonly usersService: UsersService,
    private readonly dodo: DodoService,
    private readonly subscriptions: SubscriptionsService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  @Get('billing/subscription')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  async subscription(@CurrentUser() user: AuthUser) {
    const data = await this.usersService.getBilling(user.sub);
    return ApiResponse.ok(data);
  }

  @Get('plans')
  plans() {
    return this.usersService.listPlans().then((plans) => ApiResponse.ok(plans));
  }

  @Post('billing/checkout')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  async checkout(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCheckoutDto,
  ) {
    // Use email from JWT directly — avoids profile-not-found if profile row is missing
    let email = user.email ?? '';
    if (!email) {
      try {
        const profile = await this.usersService.getMe(user.sub);
        email = profile.email;
      } catch {
        throw new BadRequestException('Could not determine user email for checkout');
      }
    }
    const url = await this.subscriptions.createCheckoutUrl(user.sub, email, dto.planId, dto.billingPeriod ?? 'yearly', dto.couponCode, dto.country);
    return ApiResponse.ok({ url });
  }

  /**
   * Schedule cancellation of the caller's subscription for the end of the
   * billing period. Takes no subscription id: it is looked up from the
   * caller's own record.
   */
  @Post('billing/subscription/cancel')
  @HttpCode(200)
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  async cancelSubscription(@CurrentUser() user: AuthUser, @Body() dto: CancelSubscriptionDto) {
    const data = await this.subscriptions.cancelSubscription(user.sub, dto);
    return ApiResponse.ok(data);
  }

  /** Undo a scheduled cancellation before the billing period ends. */
  @Post('billing/subscription/resume')
  @HttpCode(200)
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  async resumeSubscription(@CurrentUser() user: AuthUser) {
    const data = await this.subscriptions.resumeSubscription(user.sub);
    return ApiResponse.ok(data);
  }

  @Get('billing/transactions')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  async transactions(@CurrentUser() user: AuthUser) {
    const data = await this.subscriptions.getTransactions(user.sub);
    return ApiResponse.ok(data);
  }

  /**
   * Receipt PDF for one of the signed-in user's own payments, built from the
   * stored payment record (nothing is taken from the URL but its id).
   */
  @Get('billing/transactions/:id/receipt')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  async receipt(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const tx = await this.subscriptions.getTransaction(user.sub, id);
    if (!tx) throw new NotFoundException('Receipt not found');
    const profile = await this.usersService.getMe(user.sub).catch(() => null);
    const email = profile?.email || user.email || '';
    const pdf = await this.invoicePdf.generate({
      invoiceNumber: tx.invoice_number,
      transactionId: tx.transaction_id || '-',
      paymentDate: new Date(tx.payment_date).toLocaleDateString('en-IN'),
      userName: profile?.full_name || email.split('@')[0] || 'Customer',
      userEmail: email,
      planName: tx.plan_id.charAt(0).toUpperCase() + tx.plan_id.slice(1),
      amount: tx.amount,
      companyName: 'AutoClipr',
      companyWebsite: process.env.WEB_APP_URL ?? 'https://autoclipr.com',
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="autoclipr-invoice-${tx.invoice_number}.pdf"`,
      'Content-Length': pdf.length,
      'Cache-Control': 'private, no-store',
    });
    res.end(pdf);
  }

  @Get('billing/invoice/download')
  @Public()
  async downloadInvoice(
    @Query('invoiceNumber') invoiceNumber: string,
    @Query('plan') plan: string,
    @Query('amount') amount: string,
    @Query('date') date: string,
    @Query('name') name: string,
    @Query('txId') txId: string,
    @Res() res: Response,
  ) {
    const appUrl = process.env.WEB_APP_URL ?? 'https://autoclipr.com';
    const pdfBuffer = await this.invoicePdf.generate({
      invoiceNumber: invoiceNumber ?? 'N/A',
      transactionId: txId || '-',
      paymentDate: date ?? new Date().toLocaleDateString('en-IN'),
      userName: name ?? 'Customer',
      userEmail: '',
      planName: plan ?? 'Creator',
      amount: amount ?? '₹349.00',
      companyName: 'AutoClipr',
      companyWebsite: appUrl,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="autoclipr-invoice-${invoiceNumber ?? 'invoice'}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  // Called from frontend on payment success redirect — fallback when webhook is delayed/missing
  @Post('billing/activate')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  async activatePlan(
    @CurrentUser() user: AuthUser,
    @Body() dto: ActivatePlanDto,
  ) {
    this.subscriptions['logger']?.log(`[activate] userId=${user.sub} email=${user.email} planId=${dto.planId} billingPeriod=${dto.billingPeriod} txId=${dto.transactionId}`);
    await this.subscriptions.activatePlanForUser(user.sub, dto.planId, user.email, dto.transactionId, dto.billingPeriod ?? 'yearly');
    return ApiResponse.ok({ activated: true });
  }

  @Post('webhooks/dodo')
  @HttpCode(200)
  async dodoWebhook(@Req() req: RawBodyRequest<Request>) {
    const rawBody = req.rawBody?.toString() ?? JSON.stringify(req.body);
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers[k] = v;
    }

    let event: any;
    try {
      event = this.dodo.verifyWebhook(rawBody, headers);
    } catch {
      // Signature didn't verify — reject rather than trusting an unverified body.
      // A forged request here could grant a paid plan's credits for free.
      throw new UnauthorizedException('Invalid webhook signature');
    }

    await this.subscriptions.handleWebhookEvent(event, headers['webhook-id']);
    return { received: true };
  }
}
