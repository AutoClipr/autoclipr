import { Injectable } from '@nestjs/common';
import { SupabaseAdminService } from '../../database/supabase-admin.service';

export interface BrandKitRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  logo_path: string | null;
  intro_path: string | null;
  outro_path: string | null;
  intro_enabled: boolean;
  outro_enabled: boolean;
  colors: Record<string, string>;
  typography: Record<string, unknown>;
  captions: Record<string, unknown>;
  logo: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const TABLE = 'brand_kits';

/** Every query is scoped to the owner, so an id from another user never matches. */
@Injectable()
export class BrandKitsRepository {
  constructor(private readonly supabase: SupabaseAdminService) {}

  private db() {
    return this.supabase.getClient();
  }

  async list(userId: string): Promise<BrandKitRow[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as BrandKitRow[] | null) ?? [];
  }

  async count(userId: string): Promise<number> {
    const { count, error } = await this.db().from(TABLE).select('id', { count: 'exact', head: true }).eq('user_id', userId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async get(userId: string, id: string): Promise<BrandKitRow | null> {
    const { data, error } = await this.db().from(TABLE).select('*').eq('user_id', userId).eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as BrandKitRow | null) ?? null;
  }

  async insert(row: Partial<BrandKitRow> & { user_id: string; name: string }): Promise<BrandKitRow> {
    const { data, error } = await this.db().from(TABLE).insert(row).select('*').single();
    if (error) throw new Error(error.message);
    return data as BrandKitRow;
  }

  async update(userId: string, id: string, patch: Partial<BrandKitRow>): Promise<BrandKitRow | null> {
    const { data, error } = await this.db()
      .from(TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as BrandKitRow | null) ?? null;
  }

  async remove(userId: string, id: string): Promise<void> {
    const { error } = await this.db().from(TABLE).delete().eq('user_id', userId).eq('id', id);
    if (error) throw new Error(error.message);
  }

  /** Clear the user's default flag (before setting a new one — one default per user). */
  async clearDefault(userId: string): Promise<void> {
    const { error } = await this.db().from(TABLE).update({ is_default: false }).eq('user_id', userId).eq('is_default', true);
    if (error) throw new Error(error.message);
  }

  /** Whether any kit (optionally other than one) still references an asset path. */
  async assetInUse(userId: string, path: string, exceptId?: string): Promise<boolean> {
    let q = this.db()
      .from(TABLE)
      .select('id')
      .eq('user_id', userId)
      .or(`logo_path.eq."${path}",intro_path.eq."${path}",outro_path.eq."${path}"`);
    if (exceptId) q = q.neq('id', exceptId);
    const { data, error } = await q.limit(1);
    if (error) throw new Error(error.message);
    return ((data as unknown[] | null) ?? []).length > 0;
  }
}
