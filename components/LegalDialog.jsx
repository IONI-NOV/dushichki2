'use client';
import Dialog from './Dialog';
import { LEGAL } from '../lib/legal';

export default function LegalDialog({ id, onClose }) {
  return (
    <Dialog open={!!id} onClose={onClose} className="md" label="Правила">
      {id && <div className="leg" id="lgb" dangerouslySetInnerHTML={{ __html: LEGAL[id] }} />}
    </Dialog>
  );
}
