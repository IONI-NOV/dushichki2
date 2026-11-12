// Малки SVG икони и декорации
export const HeartSymbol = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <symbol id="hr" viewBox="0 0 200 190">
      <path d="M100 178 C14 118 -12 62 36 30 C68 10 94 28 100 52 C106 28 132 10 164 30 C212 62 186 118 100 178Z" fill="none" stroke="#DC0A1E" strokeWidth="20" strokeLinejoin="round" />
      <path d="M100 178 C14 118 -12 62 36 30 C68 10 94 28 100 52 C106 28 132 10 164 30 C212 62 186 118 100 178Z" fill="none" stroke="#FFF9E8" strokeWidth="8" strokeLinejoin="round" />
    </symbol>
  </svg>
);

export const Deco = ({ style }) => (
  <div className="deco" style={style} aria-hidden="true">
    <svg viewBox="0 0 200 190"><use href="#hr" /></svg>
  </div>
);

export const CartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 4h2.5l2.2 11h10.6l2-8H6.4" />
    <circle cx="9.5" cy="19.5" r="1.4" />
    <circle cx="17" cy="19.5" r="1.4" />
  </svg>
);

export const Heart = () => (
  <svg viewBox="0 0 100 90"><path d="M50 84 C8 52 20 14 50 34 C80 14 92 52 50 84Z" fill="#DC0A1E" /></svg>
);

const wingPath = 'M46 46C38 30 20 28 8 34c8 2 10 8 15 11-5 0-9 1-13 3 7 2 11 6 14 11-3 0-6 1-9 3 8 3 15 3 22-3 4-3 7-9 9-12z';
const gold = { fill: 'none', stroke: '#c9a94e', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
const Wings = () => (
  <>
    <g><path d={wingPath} /></g>
    <g transform="translate(100 0) scale(-1 1)"><path d={wingPath} /></g>
  </>
);

// Ореол / крила / и двете (за дизайна „починал близък“)
export const HALO = [
  { k: 'halo', n: 'Ореол', svg: <svg viewBox="0 0 100 100" {...gold}><ellipse cx="50" cy="50" rx="32" ry="6" /></svg> },
  { k: 'wings', n: 'Крила', svg: <svg viewBox="0 0 100 100" {...gold}><Wings /></svg> },
  { k: 'both', n: 'Ореол и крила', svg: <svg viewBox="0 0 100 100" {...gold}><g transform="translate(0 8)"><Wings /></g><ellipse cx="50" cy="20" rx="20" ry="4" /></svg> },
];
