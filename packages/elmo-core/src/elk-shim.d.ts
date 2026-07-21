// elkjs ships types for its main entry but not the bundled worker-free subpath.
declare module "elkjs/lib/elk.bundled.js" {
  interface ElkPoint {
    x: number;
    y: number;
  }
  interface ElkEdgeSection {
    startPoint: ElkPoint;
    endPoint: ElkPoint;
    bendPoints?: ElkPoint[];
  }
  interface ElkNode {
    id: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    children?: ElkNode[];
    edges?: Array<{ id: string; sections?: ElkEdgeSection[]; junctionPoints?: ElkPoint[] }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [k: string]: any;
  }
  export default class ELK {
    constructor(opts?: unknown);
    layout(graph: ElkNode): Promise<ElkNode>;
  }
}
