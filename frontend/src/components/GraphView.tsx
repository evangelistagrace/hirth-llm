import { useEffect, useRef, useState } from "react";
import cytoscape, { Core, LayoutOptions, NodeSingular } from "cytoscape";
// @ts-ignore
import coseBilkent from "cytoscape-cose-bilkent";
import { fileTypeColor } from "../utils/colors";

cytoscape.use(coseBilkent);

type GraphNode = { id: string; chunks: number; ext: string };
type GraphEdge = { source: string; target: string; similarity: number };

const LEGEND_TYPES = ["PDF", "XLSX", "DOCX", "TXT", "PNG"];

type Props = { onSelectDocument: (name: string) => void };

export default function GraphView({ onSelectDocument }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [threshold, setThreshold] = useState(0.5);
  const [loading, setLoading] = useState(true);
  const [nodeCount, setNodeCount] = useState(0);
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    setLoading(true);

    fetch(`/api/graph?threshold=${threshold}`)
      .then((r) => r.json())
      .then(({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) => {
        setNodeCount(nodes.length);

        // destroy previous instance
        cyRef.current?.destroy();

        const cy = cytoscape({
          container: containerRef.current!,
          elements: [
            ...nodes.map((n) => ({
              data: {
                id: n.id,
                label: n.id.replace(/\.[^.]+$/, ""),
                ext: n.ext,
                chunks: n.chunks,
                color: fileTypeColor(n.ext),
              },
            })),
            ...edges.map((e) => ({
              data: {
                id: `${e.source}--${e.target}`,
                source: e.source,
                target: e.target,
                similarity: e.similarity,
                width: Math.max(1, e.similarity * 5),
              },
            })),
          ],
          style: [
            {
              selector: "node",
              style: {
                "background-color": "data(color)",
                "border-color": "data(color)",
                "border-width": 2,
                "border-opacity": 0.6,
                width: (el: NodeSingular) => Math.max(28, Math.min(56, 18 + el.data("chunks") * 1.5)),
                height: (el: NodeSingular) => Math.max(28, Math.min(56, 18 + el.data("chunks") * 1.5)),
                label: "data(label)",
                "font-size": 10,
                "font-family": "IBM Plex Mono, monospace",
                color: "#EDF2FA",
                "text-valign": "bottom",
                "text-halign": "center",
                "text-margin-y": 4,
                "text-wrap": "ellipsis",
                "text-max-width": "100px",
                "text-background-color": "#070C14",
                "text-background-opacity": 0.7,
                "text-background-padding": "2px",
                "text-background-shape": "roundrectangle",
                "overlay-opacity": 0,
              },
            },
            {
              selector: "node:hover",
              style: {
                "border-width": 3,
                "border-opacity": 1,
                "background-opacity": 1,
                "z-index": 10,
                "overlay-opacity": 0,
              },
            },
            {
              selector: "node.highlighted",
              style: {
                "border-width": 3,
                "border-color": "#EDF2FA",
                "border-opacity": 1,
              },
            },
            {
              selector: "edge",
              style: {
                width: "data(width)",
                "line-color": "#7AA8E0",
                "line-opacity": 0.3,
                "curve-style": "bezier",
                "overlay-opacity": 0,
              },
            },
            {
              selector: "edge.highlighted",
              style: {
                "line-opacity": 0.85,
                "line-color": "#3878C8",
              },
            },
          ],
          layout: {
            name: "cose-bilkent",
            animate: false,
            randomize: true,
            nodeRepulsion: 6000,
            idealEdgeLength: 120,
            edgeElasticity: 0.45,
            nestingFactor: 0.1,
            gravity: 0.15,
            numIter: 2500,
            tile: true,
          } as unknown as LayoutOptions,
          userZoomingEnabled: true,
          userPanningEnabled: true,
          boxSelectionEnabled: false,
          autoungrabify: false,
        });

        // hover highlight
        cy.on("mouseover", "node", (e) => {
          const node = e.target;
          node.addClass("highlighted");
          node.connectedEdges().addClass("highlighted");
          const pos = node.renderedPosition();
          setTooltip({ label: node.data("id"), x: pos.x + 14, y: pos.y - 10 });
        });
        cy.on("mouseout", "node", (e) => {
          e.target.removeClass("highlighted");
          e.target.connectedEdges().removeClass("highlighted");
          setTooltip(null);
        });

        // click → jump to documents tab
        cy.on("tap", "node", (e) => {
          onSelectDocument(e.target.data("id"));
        });

        cyRef.current = cy;
      })
      .finally(() => setLoading(false));

    return () => { cyRef.current?.destroy(); };
  }, [threshold]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Controls */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-textdim">
          <span>Edge threshold</span>
          <input
            type="range" min={0.3} max={0.85} step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-28 accent-accent"
          />
          <span className="w-8 text-text font-mono">{threshold.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-3 ml-auto flex-wrap">
          {LEGEND_TYPES.map((ext) => (
            <div key={ext} className="flex items-center gap-1 text-xs text-textdim">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: fileTypeColor(ext) }} />
              {ext}
            </div>
          ))}
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative rounded-2xl overflow-hidden bg-surface border border-line" style={{ minHeight: 420 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-textdim z-10">
            Building graph…
          </div>
        )}
        {!loading && nodeCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-textdim z-10">
            No documents indexed yet.
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
        {tooltip && (
          <div
            className="absolute z-20 bg-surface2 border border-line text-xs text-text px-2.5 py-1.5 rounded-lg pointer-events-none shadow-lg font-mono"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.label}
          </div>
        )}
      </div>

      <p className="text-xs text-textdim text-center">
        Click a node to search documents · Scroll to zoom · Drag to pan · Adjust threshold to show more/fewer connections
      </p>
    </div>
  );
}
