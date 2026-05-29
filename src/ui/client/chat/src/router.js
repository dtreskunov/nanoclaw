// Shared router used by hash routing and the App component.
import { loadThreads, openChat, clearChat, selectGroup, loadTree, selectFile } from './actions.js';

export const router = {
  selectGroup, loadThreads, openChat, clearChat, loadTree, selectFile,
  notFound: (msg) => { console.warn(msg); },
};
