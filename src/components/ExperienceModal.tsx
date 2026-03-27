import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Experience } from '@/types/profile';

interface ExperienceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Experience;
  onSave: (data: Experience) => Promise<void>;
  mode: 'add' | 'edit';
}

export function ExperienceModal({
  isOpen,
  onClose,
  initialData,
  onSave,
  mode,
}: ExperienceModalProps) {
  const [formData, setFormData] = useState<Experience>(
    initialData || {
      cargo: '',
      empresa: '',
      fechaInicio: '',
      fechaFin: null,
      esActual: false,
      descripcion: '',
      ubicacion: '',
    }
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">
            {mode === 'add' ? 'Agregar Experiencia' : 'Editar Experiencia'}
          </h2>
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
              <Label htmlFor="cargo">Cargo *</Label>
              <Input
                id="cargo"
                type="text"
                value={formData.cargo}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                placeholder="Ej: Desarrollador Full Stack"
                required
                className="mt-1"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="empresa">Empresa *</Label>
              <Input
                id="empresa"
                type="text"
                value={formData.empresa}
                onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                placeholder="Ej: Tech Solutions Inc"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="fechaInicio">Fecha de inicio *</Label>
              <Input
                id="fechaInicio"
                type="date"
                value={formData.fechaInicio}
                onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="fechaFin">Fecha de fin</Label>
              <Input
                id="fechaFin"
                type="date"
                value={formData.fechaFin || ''}
                onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value || null })}
                disabled={formData.esActual}
                className="mt-1"
              />
            </div>

            <div className="col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.esActual}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      esActual: e.target.checked,
                      fechaFin: e.target.checked ? null : formData.fechaFin,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-600/20"
                />
                <span className="text-sm font-medium text-slate-700">
                  Actualmente trabajo aquí
                </span>
              </label>
            </div>

            <div className="col-span-2">
              <Label htmlFor="ubicacion">Ubicación</Label>
              <Input
                id="ubicacion"
                type="text"
                value={formData.ubicacion || ''}
                onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                placeholder="Ej: Bogotá, Colombia"
                className="mt-1"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <textarea
                id="descripcion"
                value={formData.descripcion || ''}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Describe tus responsabilidades y logros..."
                rows={4}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : mode === 'add' ? 'Agregar' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
