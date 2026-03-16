'use client';

import HeroMetrics from '../components/HeroMetrics';

const mockMetrics = {
  revenue: {
    label: 'Ingresos del Mes',
    value: '$1,245,890 MXN',
    trend: { value: 12.5, isPositive: true },
    sparkline: [65, 78, 52, 91, 83],
  },
  tickets: {
    label: 'Boletos Vendidos',
    value: '8,432',
    trend: { value: 8.3, isPositive: true },
    sparkline: [45, 62, 78, 55, 89],
  },
  occupancy: {
    label: 'Ocupación Promedio',
    value: '76%',
    trend: { value: 3.2, isPositive: false },
    sparkline: [82, 75, 79, 71, 76],
  },
  upcoming: {
    label: 'Funciones Próximas',
    value: '24',
    trend: { value: 15.0, isPositive: true },
    sparkline: [18, 22, 19, 25, 24],
  },
};

const alertas = [
  { id: 1, tipo: 'critico', mensaje: 'Función "Romeo y Julieta" 18:00 - Solo quedan 5 lugares disponibles' },
  { id: 2, tipo: 'critico', mensaje: 'Error en terminal de pago #3 - Requiere atención inmediata' },
  { id: 3, tipo: 'warning', mensaje: 'Stock bajo de boletos impresos para Sala Principal' },
  { id: 4, tipo: 'info', mensaje: 'Reporte semanal listo para revisión' },
];

const funcionesProximas = [
  { id: 1, nombre: 'Romeo y Julieta', hora: '18:00', sala: 'Sala Principal', ocupacion: 95 },
  { id: 2, nombre: 'El Fantasma de la Ópera', hora: '19:30', sala: 'Sala A', ocupacion: 78 },
  { id: 3, nombre: 'Los Miserables', hora: '20:00', sala: 'Sala B', ocupacion: 45 },
  { id: 4, nombre: 'Cats', hora: '20:30', sala: 'Sala Principal', ocupacion: 62 },
  { id: 5, nombre: 'Chicago', hora: '21:00', sala: 'Sala C', ocupacion: 28 },
];

const actividadReciente = [
  { id: 1, tipo: 'venta', mensaje: 'Venta de 4 boletos - Romeo y Julieta', tiempo: 'Hace 2 min' },
  { id: 2, tipo: 'reembolso', mensaje: 'Reembolso procesado - $450 MXN', tiempo: 'Hace 5 min' },
  { id: 3, tipo: 'venta', mensaje: 'Venta de 2 boletos - El Fantasma de la Ópera', tiempo: 'Hace 8 min' },
  { id: 4, tipo: 'reservacion', mensaje: 'Nueva reservación grupal - 15 personas', tiempo: 'Hace 12 min' },
  { id: 5, tipo: 'venta', mensaje: 'Venta de 6 boletos - Los Miserables', tiempo: 'Hace 15 min' },
  { id: 6, tipo: 'cancelacion', mensaje: 'Cancelación de reservación #4521', tiempo: 'Hace 18 min' },
  { id: 7, tipo: 'venta', mensaje: 'Venta de 2 boletos - Cats', tiempo: 'Hace 22 min' },
  { id: 8, tipo: 'venta', mensaje: 'Venta de 8 boletos - Chicago', tiempo: 'Hace 25 min' },
  { id: 9, tipo: 'reservacion', mensaje: 'Reservación corporativa - 30 personas', tiempo: 'Hace 30 min' },
  { id: 10, tipo: 'venta', mensaje: 'Venta de 3 boletos - Romeo y Julieta', tiempo: 'Hace 35 min' },
];

function getOcupacionColor(ocupacion: number): string {
  if (ocupacion >= 80) return 'bg-red-500';
  if (ocupacion >= 50) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getActividadColor(tipo: string): string {
  switch (tipo) {
    case 'venta':
      return 'bg-green-500';
    case 'reembolso':
      return 'bg-orange-500';
    case 'reservacion':
      return 'bg-blue-500';
    case 'cancelacion':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

export default function SummaryPage() {
  return (
    <div className="min-h-screen bg-[#f8f6f6] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel de Control</h1>
          <p className="text-gray-500 mt-1">Resumen de operaciones de boletería</p>
        </div>

        <HeroMetrics
          revenue={mockMetrics.revenue}
          tickets={mockMetrics.tickets}
          occupancy={mockMetrics.occupancy}
          upcoming={mockMetrics.upcoming}
        />

        {/* Sección de Alertas */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Alertas</h2>
          <div className="space-y-3">
            {alertas.map((alerta) => (
              <div
                key={alerta.id}
                className={`p-4 rounded-lg ${
                  alerta.tipo === 'critico'
                    ? 'bg-red-50 border border-red-200'
                    : alerta.tipo === 'warning'
                    ? 'bg-yellow-50 border border-yellow-200'
                    : 'bg-blue-50 border border-blue-200'
                }`}
              >
                <p
                  className={`text-sm ${
                    alerta.tipo === 'critico'
                      ? 'text-red-800'
                      : alerta.tipo === 'warning'
                      ? 'text-yellow-800'
                      : 'text-blue-800'
                  }`}
                >
                  {alerta.mensaje}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Sección de Funciones Próximas */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Funciones Próximas</h2>
          <div className="space-y-4">
            {funcionesProximas.map((funcion) => (
              <div key={funcion.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{funcion.nombre}</p>
                  <p className="text-sm text-gray-500">
                    {funcion.hora} • {funcion.sala}
                  </p>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-48">
                  <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getOcupacionColor(funcion.ocupacion)} rounded-full`}
                      style={{ width: `${funcion.ocupacion}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-12 text-right">
                    {funcion.ocupacion}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sección de Actividad Reciente */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Actividad Reciente</h2>
          <div className="space-y-3">
            {actividadReciente.map((actividad) => (
              <div key={actividad.id} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${getActividadColor(actividad.tipo)}`} />
                <p className="flex-1 text-sm text-gray-700">{actividad.mensaje}</p>
                <span className="text-xs text-gray-400">{actividad.tiempo}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sección de Clientes Recientes */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Clientes Recientes</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { id: 1, nombre: 'María González Hernández', email: 'maria.gonzalez@gmail.com', ordenes: 12, gastado: 8450, boletos: 28 },
              { id: 2, nombre: 'Carlos Ramírez López', email: 'carlos.ramirez@hotmail.com', ordenes: 8, gastado: 5200, boletos: 16 },
              { id: 3, nombre: 'Ana Martínez Sánchez', email: 'ana.martinez@outlook.com', ordenes: 5, gastado: 3100, boletos: 10 },
            ].map((cliente) => (
              <div key={cliente.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="rounded-full bg-[#E63946] text-white w-10 h-10 flex items-center justify-center font-bold">
                    {cliente.nombre.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{cliente.nombre}</p>
                    <p className="text-gray-500 text-sm">{cliente.email}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">{cliente.ordenes} órdenes · ${cliente.gastado.toLocaleString()} gastado · {cliente.boletos} boletos</p>
                <button onClick={() => alert(`Detalle de ${cliente.nombre}`)} className="text-sm text-[#E63946]">Ver detalle</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
