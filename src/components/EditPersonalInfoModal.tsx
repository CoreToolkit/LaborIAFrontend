import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EditPersonalInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: {
    nombre: string;
    email: string;
    telefono?: string;
    ubicacion?: string;
    carrera?: string;
    universidad?: string;
    fechaGraduacion?: string;
    bio?: string;
    nivelIngles?: string;
  };
  onSave: (data: {
    nombre: string;
    email: string;
    telefono?: string;
    ubicacion?: string;
    carrera?: string;
    universidad?: string;
    fechaGraduacion?: string;
    bio?: string;
    nivelIngles?: string;
  }) => Promise<void>;
}

export function EditPersonalInfoModal({
  isOpen,
  onClose,
  initialData,
  onSave,
}: EditPersonalInfoModalProps) {
  const [formData, setFormData] = useState(initialData);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto py-8">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Editar Información Personal</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="nombre">Nombre completo *</Label>
            <Input
              id="nombre"
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="email">Correo electrónico *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              type="tel"
              value={formData.telefono || ''}
              onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
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

          <div>
            <Label htmlFor="carrera">Carrera</Label>
            <Input
              id="carrera"
              type="text"
              value={formData.carrera || ''}
              onChange={(e) => setFormData({ ...formData, carrera: e.target.value })}
              placeholder="Ej: Ingeniería de Sistemas"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="universidad">Universidad</Label>
            <Input
              id="universidad"
              type="text"
              value={formData.universidad || ''}
              onChange={(e) => setFormData({ ...formData, universidad: e.target.value })}
              placeholder="Ej: Universidad Nacional de Colombia"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="fechaGraduacion">Fecha de Graduación</Label>
            <Input
              id="fechaGraduacion"
              type="date"
              value={formData.fechaGraduacion || ''}
              onChange={(e) => setFormData({ ...formData, fechaGraduacion: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="bio">Descripción</Label>
            <textarea
              id="bio"
              value={formData.bio || ''}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Cuéntanos sobre ti..."
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="nivelIngles">Nivel de Inglés</Label>
            <select
              id="nivelIngles"
              value={formData.nivelIngles || ''}
              onChange={(e) => setFormData({ ...formData, nivelIngles: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Seleccionar nivel de inglés"
            >
              <option value="">Seleccionar nivel</option>
              <option value="Basico">Básico</option>
              <option value="Intermedio">Intermedio</option>
              <option value="Avanzado">Avanzado</option>
              <option value="Nativo">Nativo</option>
            </select>
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
