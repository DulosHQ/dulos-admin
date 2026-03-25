import { z } from 'zod';

export const eventSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  slug: z.string().min(1, 'El slug es requerido').regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  status: z.enum(['active', 'draft', 'archived']),
  image_url: z.string().url('URL inválida').or(z.literal('')).optional(),
  description: z.string().optional(),
  long_description: z.string().optional(),
  venue_id: z.string().uuid('Venue ID inválido').optional(),
  event_type: z.enum(['single', 'recurring', 'season']).optional(),
  category: z.string().optional(),
  start_date: z.string().optional(), // ISO datetime
  end_date: z.string().optional(),
  price_from: z.number().min(0).optional(),
  original_price: z.number().min(0).optional(),
  featured: z.boolean().optional(),
  show_remaining: z.boolean().optional(),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
});

export type EventFormData = z.infer<typeof eventSchema>;
