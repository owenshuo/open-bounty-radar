import {algoraAdapter} from './algora.js';
import {adapterMetadata} from './contract.js';
import {githubAdapter} from './github.js';
import {opireAdapter} from './opire.js';

export const adapters = {
  github: githubAdapter,
  algora: algoraAdapter,
  opire: opireAdapter,
};

export function adapterList() {
  return Object.values(adapters).map(adapterMetadata);
}
