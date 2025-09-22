declare module 'p5' {
  export default class P5 {
    constructor(sketch: (p: P5) => void, node?: HTMLElement);
    [key: string]: any;
  }
}
