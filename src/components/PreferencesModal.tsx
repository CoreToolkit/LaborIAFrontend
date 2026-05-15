import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Preferencias } from '@/types/profile';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: Preferencias;
  onSave: (data: Preferencias) => Promise<void>;
}

const DEFAULT_PREFERENCES: Preferencias = {
  cargo: '',
  industria: '',
  ubicacion: '',
  salarioEsperado: 0,
  tipoContrato: '',
  disponibilidadInmediata: false,
};

export function PreferencesModal({
  isOpen,
  onClose,
  initialData,
  onSave,
}: PreferencesModalProps) {
  const [formData, setFormData] = useState<Preferencias>(initialData || DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincronizar formData cuando initialData o isOpen cambien
  useEffect(() => {
    if (isOpen) {
      setFormData(initialData || DEFAULT_PREFERENCES);
      setError(null);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      console.log('Guardando preferencias:', formData);
      await onSave(formData);
      console.log('Preferencias guardadas exitosamente');
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar las preferencias';
      console.error('Error al guardar preferencias:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Editar Preferencias Laborales</h2>
          <button
            onClick={onClose}
            className="text-slate-400 transition-colors hover:text-slate-600"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="cargo">Cargo deseado</Label>
              <Input
                id="cargo"
                type="text"
                value={formData.cargo || ''}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                placeholder="Ej: Desarrollador Senior, Gerente de Proyectos"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="industria">Industria</Label>
              <Input
                id="industria"
                type="text"
                value={formData.industria || ''}
                onChange={(e) => setFormData({ ...formData, industria: e.target.value })}
                placeholder="Ej: Tecnología, Finanzas"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="ubicacion">Ubicación preferida</Label>
              <Input
                id="ubicacion"
                type="text"
                value={formData.ubicacion || ''}
                onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                placeholder="Ej: Bogotá, Remoto"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="salarioEsperado">Salario esperado (COP)</Label>
              <Input
                id="salarioEsperado"
                type="number"
                value={formData.salarioEsperado || ''}
                onChange={(e) =>
                  setFormData({ ...formData, salarioEsperado: Number(e.target.value) })
                }
                placeholder="Ej: 5000000"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="tipoContrato">Tipo de contrato</Label>
              <select
                id="tipoContrato"
                value={formData.tipoContrato || ''}
                onChange={(e) => setFormData({ ...formData, tipoContrato: e.target.value })}
                aria-label="Tipo de contrato"
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                <option value="">Seleccionar...</option>
                <option value="Tiempo completo">Tiempo completo</option>
                <option value="Medio tiempo">Medio tiempo</option>
                <option value="Pasantía">Pasantía</option>
                <option value="Freelance">Freelance</option>
                <option value="Contrato">Contrato</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.disponibilidadInmediata || false}
                  onChange={(e) =>
                    setFormData({ ...formData, disponibilidadInmediata: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-600/20"
                />
                <span className="text-sm font-medium text-slate-700">
                  Disponibilidad inmediata
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
