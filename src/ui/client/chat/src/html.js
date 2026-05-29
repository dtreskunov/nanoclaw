// Shared htm + h binding so every component imports from one place.
import { h } from 'preact';
import htm from 'htm';

export const html = htm.bind(h);
