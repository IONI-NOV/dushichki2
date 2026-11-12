'use client';
import Dialog from './Dialog';
import { KIND } from '../lib/data';

export default function SizeDialog({ kind, onClose }) {
  const K = kind ? KIND[kind] : null;
  return (
    <Dialog open={!!kind} onClose={onClose} className="sm" label="Размери">
      {K && (
        <div className="in" id="scb">
          <h2>Размери – {K.one}</h2>
          <p className="uni"><b>Унисекс</b> – {K.plural} са един и същ модел за жени и мъже.</p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <tbody>
                <tr>{K.chart.cols.map((c) => <th key={c}>{c}</th>)}</tr>
                {K.chart.rows.map((r) => (
                  <tr key={r[0]}>
                    {r.map((x, j) => <td key={j}>{j ? String(x).replace('.', ',') : <b>{x}</b>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 12, fontSize: '.85rem', color: '#666' }}>Размерите са в сантиметри.</p>
        </div>
      )}
    </Dialog>
  );
}
