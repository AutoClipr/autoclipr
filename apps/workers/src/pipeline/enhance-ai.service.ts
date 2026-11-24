import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { createHookAnalysisLlmClient } from './llm-client.util';
import { runCommand } from './exec.util';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', it: 'Italian',
  ar: 'Arabic', id: 'Indonesian', nl: 'Dutch', tr: 'Turkish',
};

/** Where Alpine's font-noto-emoji puts the colour emoji font. */
const EMOJI_FONTS = ['/usr/share/fonts/noto/NotoColorEmoji.ttf', '/usr/share/fonts/noto-emoji/NotoColorEmoji.ttf', '/usr/share/fonts/TTF/NotoColorEmoji.ttf'];

const RENDER_EMOJI_PY = `
import sys
from PIL import Image, ImageDraw, ImageFont
font = ImageFont.truetype(sys.argv[1], 109)
img = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
ImageDraw.Draw(img).text((80, 80), sys.argv[2], font=font, embedded_color=True, anchor="mm")
box = img.getbbox()
(img.crop(box) if box else img).save(sys.argv[3])
`;

/**
 * AI calls for enhancements: caption translation (the analysis LLM),
 * dubbing speech (OpenAI text-to-speech) and colour emoji images.
 */
@Injectable()
export class EnhanceAiService implements OnModuleInit {
  private readonly logger = new Logger(EnhanceAiService.name);
  private llm: OpenAI | null = null;
  private model = 'gpt-4o';
  private tts: OpenAI | null = null;
  private emojiCache = new Map<string, string | null>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const cfg = createHookAnalysisLlmClient(this.config);
    this.llm = cfg.client;
    this.model = cfg.model;
    const key = this.config.get<string>('openaiApiKey');
    this.tts = key ? new OpenAI({ apiKey: key, maxRetries: 2, timeout: 60_000 }) : null;
  }

  get canDub() {
    return !!this.tts;
  }

  /**
   * Translate caption lines, one output per input, keeping order. Throws when
   * no LLM is configured or the reply doesn't line up (caller falls back).
   */
  async translateLines(lines: string[], language: string): Promise<string[]> {
    if (!lines.length) return [];
    if (!this.llm) throw new Error('No translation model configured');
    const name = LANGUAGE_NAMES[language] ?? language;
    const out: string[] = [];
    for (let i = 0; i < lines.length; i += 60) {
      const batch = lines.slice(i, i + 60);
      const completion = await this.llm.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You output only valid JSON for video editors.' },
          {
            role: 'user',
            content:
              `Translate each subtitle line into ${name}. Keep meaning and tone, keep each line about as short as the original, ` +
              'do not merge or split lines, keep names and numbers. ' +
              `Return {"lines": [...]} with exactly ${batch.length} strings in the same order.\n\n` +
              JSON.stringify(batch),
          },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
        max_tokens: 4096,
      });
      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as { lines?: unknown };
      const got = Array.isArray(parsed.lines) ? parsed.lines.map((l) => String(l ?? '').trim()) : [];
      if (got.length !== batch.length) throw new Error(`Translation returned ${got.length} of ${batch.length} lines`);
      out.push(...got);
    }
    return out;
  }

  /** Speak one line into an mp3 file. */
  async speak(text: string, outPath: string): Promise<void> {
    if (!this.tts) throw new Error('Voice dubbing needs OPENAI_API_KEY on the worker');
    const res = await this.tts.audio.speech.create({
      model: this.config.get<string>('ttsModel') || 'gpt-4o-mini-tts',
      voice: (this.config.get<string>('ttsVoice') || 'alloy') as 'alloy',
      input: text.slice(0, 4000),
      response_format: 'mp3',
    });
    await fs.writeFile(outPath, Buffer.from(await res.arrayBuffer()));
  }

  /**
   * A colour emoji as a transparent PNG (cached per job directory), or null
   * when the emoji font or Pillow isn't available (caller uses symbols).
   */
  async emojiPng(emoji: string, dir: string): Promise<string | null> {
    const key = `${dir}|${emoji}`;
    if (this.emojiCache.has(key)) return this.emojiCache.get(key)!;
    const font = EMOJI_FONTS.find((f) => existsSync(f));
    let result: string | null = null;
    if (font) {
      const out = path.join(dir, `emoji_${[...emoji].map((c) => c.codePointAt(0)!.toString(16)).join('_')}.png`);
      try {
        await runCommand('python3', ['-c', RENDER_EMOJI_PY, font, emoji, out], { timeoutMs: 20_000 });
        result = out;
      } catch (err) {
        this.logger.warn(`Colour emoji render failed (${emoji}): ${(err as Error).message}`);
      }
    }
    this.emojiCache.set(key, result);
    return result;
  }
}
