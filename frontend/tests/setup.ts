import { TextDecoder, TextEncoder } from 'util';
Object.assign(globalThis, { TextEncoder, TextDecoder });
import '@testing-library/jest-dom';

class IO { observe() { /* noop */ } unobserve() { /* noop */ } disconnect() { /* noop */ } takeRecords() { return []; } }
(globalThis as any).IntersectionObserver = IO;
(globalThis as any).ResizeObserver = IO;
window.scrollTo = jest.fn() as any;
Element.prototype.scrollIntoView = jest.fn();
Object.defineProperty(window, 'matchMedia', { writable: true, value: (q: string) => ({ matches: false, media: q, addEventListener: jest.fn(), removeEventListener: jest.fn(), addListener: jest.fn(), removeListener: jest.fn(), onchange: null, dispatchEvent: jest.fn() }) });
