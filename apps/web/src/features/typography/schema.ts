import { z } from "zod";
import { BUILTIN_FONT_NAMES } from "./font-catalog";

const HEX_OR_VAR = /^(#[0-9A-Fa-f]{6}|var\(--[A-Za-z0-9_-]{2,48}\))$/;
const SIZE_UNIT = /^(\d+(?:\.\d+)?)(px|rem|em)$/;
const CLAMP_EXPR = /^clamp\(\s*[0-9.,+\-pxremvwchq%\s/*()]{3,90}\)$/;
const LETTER_SPACING_UNIT = /^((-?\d+(?:\.\d+)?)(px|rem|em)|0|normal)$/;
const TEXT_INDENT_UNIT = /^((-?\d+(?:\.\d+)?)(px|rem|em|%)|0)$/;

const fontSizeScalarSchema = z
  .string()
  .trim()
  .refine(
    (v) => SIZE_UNIT.test(v) || CLAMP_EXPR.test(v),
    "Font size must use px, rem, em, or clamp(...)"
  );

const lineHeightScalarSchema = z.union([
  z.number().min(0.8).max(3.5),
  z
    .string()
    .trim()
    .refine(
      (v) => /^(\d+(?:\.\d+)?)(px|rem|em)?$/.test(v),
      "Invalid line-height value"
    ),
]);

const letterSpacingScalarSchema = z
  .string()
  .trim()
  .refine(
    (v) => LETTER_SPACING_UNIT.test(v),
    "Letter spacing must use px, rem, em, 0, or normal"
  );

export function responsiveSchema<T extends z.ZodTypeAny>(inner: T) {
  return z.union([
    inner,
    z.object({
      desktop: inner,
      tablet: inner.optional(),
      mobile: inner.optional(),
    }),
  ]);
}

export const typographyFontConfigSchema = z.object({
  family: z.string().trim().min(1).max(64),
  source: z.enum(["google", "system", "custom"]),
  weights: z.array(z.number().int().min(100).max(900)).min(1).max(9),
  style: z.enum(["normal", "italic"]),
  fallback: z.string().trim().min(1).max(100),
  url: z
    .string()
    .trim()
    .refine(
      (u) =>
        u.startsWith("/storage/") &&
        !u.includes("..") &&
        (/\.(woff2|woff|ttf)$/i.test(u)),
      "Custom font must point to /storage/*.woff2, .woff, or .ttf"
    )
    .optional(),
  format: z.enum(["woff2", "woff", "truetype"]).optional(),
  variable: z.boolean().optional(),
});

export const typographyPresetSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,48}$/),
  name: z.string().trim().min(1).max(60),
  category: z.enum(["headings", "body", "interactive", "custom"]),
  builtIn: z.boolean(),
  fontFamily: z.string().trim().min(1).max(64),
  fontSize: responsiveSchema(fontSizeScalarSchema),
  fluidSize: z
    .string()
    .trim()
    .refine((v) => v === "" || CLAMP_EXPR.test(v), "Invalid CSS clamp(...) expression")
    .optional(),
  useFluid: z.boolean().optional(),
  fontWeight: z.number().int().min(100).max(900),
  fontStyle: z.enum(["normal", "italic", "oblique"]).optional(),
  fontStretch: z
    .enum(["condensed", "semi-condensed", "normal", "semi-expanded", "expanded"])
    .optional(),
  color: z
    .string()
    .trim()
    .refine((v) => v === "" || HEX_OR_VAR.test(v), "Invalid color hex or token")
    .optional(),
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).optional(),
  textDecoration: z.enum(["none", "underline", "line-through"]).optional(),
  textAlign: z.enum(["left", "center", "right", "justify"]).optional(),
  lineHeight: responsiveSchema(lineHeightScalarSchema),
  letterSpacing: responsiveSchema(letterSpacingScalarSchema).optional(),
  wordSpacing: z.string().trim().refine((v) => v === "" || LETTER_SPACING_UNIT.test(v)).optional(),
  textShadow: z.string().trim().max(120).optional(),
  textIndent: z.string().trim().refine((v) => v === "" || TEXT_INDENT_UNIT.test(v)).optional(),
  textWrap: z.enum(["wrap", "nowrap", "balance", "pretty"]).optional(),
  textOverflow: z.enum(["clip", "ellipsis"]).optional(),
});

const builtInFontSet = new Set(BUILTIN_FONT_NAMES);

export const globalTypographySchema = z
  .object({
    schemaVersion: z.number().int().min(1).max(10).optional(),
    headingFont: z.string().trim().min(1).max(64),
    bodyFont: z.string().trim().min(1).max(64),
    fonts: z
      .object({
        primary: typographyFontConfigSchema.optional(),
        secondary: typographyFontConfigSchema.optional(),
        heading: typographyFontConfigSchema.optional(),
        body: typographyFontConfigSchema.optional(),
        monospace: typographyFontConfigSchema.optional(),
      })
      .optional(),
    presets: z.record(z.string(), typographyPresetSchema).optional(),
  })
  .superRefine((val, ctx) => {
    const customFamilies = new Set<string>();
    if (val.fonts) {
      for (const [role, cfg] of Object.entries(val.fonts)) {
        if (!cfg) continue;
        if (cfg.source === "custom") {
          customFamilies.add(cfg.family);
        } else if (!builtInFontSet.has(cfg.family)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unsupported built-in font for ${role}: ${cfg.family}`,
          });
        }
      }
    }
    for (const key of ["headingFont", "bodyFont"] as const) {
      const f = val[key];
      if (!builtInFontSet.has(f) && !customFamilies.has(f)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unsupported ${key}: ${f}`,
        });
      }
    }
    if (val.presets && Object.keys(val.presets).length > 40) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cannot define more than 40 typography presets",
      });
    }
  });
