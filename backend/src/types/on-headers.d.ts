declare module 'on-headers' {
  import { ServerResponse } from 'http';
  function onHeaders(res: ServerResponse, listener: () => void): void;
  export = onHeaders;
}
