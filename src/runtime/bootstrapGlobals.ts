import Lenis from 'lenis';
import Matter from 'matter-js';

declare global {
  interface Window {
    Lenis?: typeof Lenis;
    Matter?: typeof Matter;
  }
}

window.Lenis = Lenis;
window.Matter = Matter;

