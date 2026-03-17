# BLOQUE 7 — Bug Fixes & Missing Data

## CRITICAL BUGS FROM SCREENSHOTS

### BUG 1: Eventos page shows "No hay eventos" (CRITICAL)
The EventsPage.tsx data loading destructures row_data as arrays:
```ts
const [proyecto, productor, estado, eventos, ingresos, comision] = row;
```
But row_data items are OBJECTS with named keys:
```json
{"Estado": "PUBLISHED", "Eventos": "1", "Ingresos": "$0", "Proyecto": "Archivo Confidencial...", "Comisión": "+$0", "Productor": "$0"}
```

FIX: Change to object access:
```ts
const proyecto = row['Proyecto'] || row.Proyecto || '';
const estado = row['Estado'] || row.Estado || '';
const eventos = row['Eventos'] || row.Eventos || '0';
const ingresos = row['Ingresos'] || row.Ingresos || '$0';
const comision = row['Comisión'] || row.Comisión || '+$0';
```

NOTE: The "Productor" column in the scraped data contains the MONEY amount (e.g., "$321,989"), NOT the producer name. The actual producer for ALL projects is "Francisco Paolo Dupeyron Gutierrez". Hardcode this or use the Comisiones tab data.

### BUG 2: "Ingresos por Evento" images look bad in Vista General
The images are cropped/repeated and the layout is awkward with 3 columns.
FIX in SummaryPage.tsx:
- Make the "Ingresos por Evento" section use a clean list layout instead of grid
- Each row: event image (40x40 rounded), event name, venue, revenue amount aligned right
- Sort by revenue descending
- Remove the separate orders/boletos text (too dense)

### BUG 3: Funciones Próximas date format wrong
Shows "6 mar 2026" but the event is March 21, 2026. The start_date from Supabase is in UTC and needs proper timezone handling.
Check: "Infierno" start_date is "2026-03-14T02:00:00+00:00" but schedule shows "2026-03-21".
The event start_date may not match the actual schedule dates.
FIX: Use dulos_schedules dates for "Funciones Próximas" instead of event start_date when available.

### BUG 4: OpsPage — Reservas/Boletos tabs may have same object access issue
The OpsPage also uses fetchReservas() and fetchBoletos() from dashboard_tabs.
Verify it accesses row data as objects, not arrays.
Row data format for Reservas:
```json
{"Estado": "ACTIVE", "Evento": "...", "Expira": "...", "Cliente": "...", "Cantidad": "1", "Session ID": "...", "Tipo de Boleto": "General"}
```

Row data format for Boletos:
```json
{"Tipo": "General", "Monto": "$299", "Boleto": "UUID...", "Creado": "...", "Estado": "VALID", "Evento": "...", "Cliente": "...", "Función": "...", "Nombre Asistente": "...", "Apellido Asistente": "..."}
```

Row data format for Pedidos:
```json
{"Fecha": "...", "Total": "$299", "Evento": "...", "Cliente": "...", "Comisión": "+$30", "ID Pedido": "#6c3cfef7...", "Productor": "$269"}
```

Check ALL pages that use fetchDashboardTab data and ensure they use object key access.

### BUG 5: FinancePage — Pedidos/Comisiones data access
The FinancePage fetches pedidos and comisiones. Verify it accesses as objects too.
Comisiones row:
```json
{"Eventos": "20", "Órdenes": "1,419", "Productor": "Francisco Paolo Dupeyron Gutierrez", "Para Productor": "$1,281,737", "Comisión Total": "+$142,415", "Ingresos Totales": "$1,424,152"}
```

## DESIGN IMPROVEMENT: Merge event image sections in Vista General
Johan says the "Ingresos por Evento" cards with images don't make sense as separate from "Funciones Próximas" which also has images.

SOLUTION: Remove the separate "Ingresos por Evento" section. Instead, ADD the revenue data INTO the "Funciones Próximas" cards. Each event card shows:
- Image (left, already there)
- Name, date, venue (already there)  
- Occupancy % (already there)
- Revenue amount (NEW — add below the available count)
- Available count (already there)

This eliminates duplication and follows "la información te busca a ti" — one card, all info.

## VERIFY
After ALL fixes: `npx tsc --noEmit` must pass. Test the build too: `npx next build`.
