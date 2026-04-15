import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillModal } from '@/components/SkillModal';
import { Skill } from '@/types/profile';

const skillA: Skill = {
  id: '1',
  nombre: 'Node.js',
  tipo: 'tecnica',
  nivel: 'Intermedio',
  descripcion: 'Backend API',
};

const skillB: Skill = {
  id: '2',
  nombre: 'React',
  tipo: 'tecnica',
  nivel: 'Avanzado',
  descripcion: 'Frontend web',
};

describe('SkillModal', () => {
  const onClose = vi.fn();
  const onSave = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates form fields when editing a different skill', async () => {
    const { rerender } = render(
      <SkillModal
        isOpen={true}
        onClose={onClose}
        initialData={skillA}
        onSave={onSave}
        mode="edit"
      />
    );

    expect((screen.getByLabelText(/Nombre de la habilidad/i) as HTMLInputElement).value).toBe('Node.js');

    rerender(
      <SkillModal
        isOpen={true}
        onClose={onClose}
        initialData={skillB}
        onSave={onSave}
        mode="edit"
      />
    );

    expect((screen.getByLabelText(/Nombre de la habilidad/i) as HTMLInputElement).value).toBe('React');
    expect((screen.getByLabelText(/Tipo de habilidad/i) as HTMLSelectElement).value).toBe('tecnica');
    expect((screen.getByLabelText(/Nivel de dominio/i) as HTMLSelectElement).value).toBe('Avanzado');
    expect((screen.getByLabelText(/Descripción/i) as HTMLTextAreaElement).value).toBe('Frontend web');
  });

  it('resets form fields when opening in add mode after editing', async () => {
    const { rerender } = render(
      <SkillModal
        isOpen={true}
        onClose={onClose}
        initialData={skillA}
        onSave={onSave}
        mode="edit"
      />
    );

    expect((screen.getByLabelText(/Nombre de la habilidad/i) as HTMLInputElement).value).toBe('Node.js');

    rerender(
      <SkillModal
        isOpen={false}
        onClose={onClose}
        initialData={skillA}
        onSave={onSave}
        mode="edit"
      />
    );

    rerender(
      <SkillModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        mode="add"
      />
    );

    expect((screen.getByLabelText(/Nombre de la habilidad/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/Tipo de habilidad/i) as HTMLSelectElement).value).toBe('tecnica');
    expect((screen.getByLabelText(/Nivel de dominio/i) as HTMLSelectElement).value).toBe('Intermedio');
    expect((screen.getByLabelText(/Descripción/i) as HTMLTextAreaElement).value).toBe('');
  });
});
