import React, { useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
} from '@xyflow/react';
import { CustomNode } from './CustomNode';
import { useSupplyChain } from '../../context/SupplyChainContext';
import { DigitalTwinNode } from '../../types';
import {
  Sparkles,
  Play,
  Info,
} from 'lucide-react';
import { Button } from '../common/Button';
import { NeonBadge } from '../common/NeonBadge';
import { soundFX } from '../../services/audioService';

const nodeTypes = {
  custom: CustomNode,
};

// Node positioning layout
const nodeLayoutPositions: Record<string, { x: number; y: number }> = {
  'node-t2-tsmc': { x: 50, y: 80 },
  'node-t2-skhynix': { x: 50, y: 260 },
  'node-t2-basf': { x: 50, y: 440 },
  'node-t1-foxconn': { x: 380, y: 120 },
  'node-t1-bosch': { x: 380, y: 320 },
  'node-t1-denso': { x: 380, y: 490 },
  'node-factory-austin': { x: 720, y: 150 },
  'node-factory-munich': { x: 720, y: 340 },
  'node-factory-shanghai': { x: 720, y: 500 },
  'node-wh-memphis': { x: 1060, y: 100 },
  'node-wh-rotterdam': { x: 1060, y: 300 },
  'node-wh-singapore': { x: 1060, y: 490 },
  'node-cust-enterprise-us': { x: 1390, y: 120 },
};

interface DigitalTwinViewProps {
  onNavigate: (pageId: string) => void;
}

export const DigitalTwinView: React.FC<DigitalTwinViewProps> = ({ onNavigate }) => {
  const { digitalTwinNodes, digitalTwinEdges, runSimulation } = useSupplyChain();

  const [filterType, setFilterType] = useState<string>('all');
  const [selectedNode, setSelectedNode] = useState<DigitalTwinNode | null>(null);

  // Map domain nodes to ReactFlow nodes
  const initialNodes: Node[] = useMemo(() => {
    return digitalTwinNodes.map((n, idx) => ({
      id: n.id,
      type: 'custom',
      position: nodeLayoutPositions[n.id] || { x: 100 + (idx % 3) * 320, y: 80 + Math.floor(idx / 3) * 180 },
      data: { ...(n as unknown as Record<string, unknown>) },
    }));
  }, [digitalTwinNodes]);

  // Map domain edges to ReactFlow edges
  const initialEdges: Edge[] = useMemo(() => {
    return digitalTwinEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: e.animated ?? true,
      style: {
        stroke: e.status === 'warning' ? '#F59E0B' : e.status === 'critical' ? '#EF4444' : '#3B82F6',
        strokeWidth: e.isBottleneck ? 3 : 2,
      },
    }));
  }, [digitalTwinEdges]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    soundFX.playClick();
    setSelectedNode(node.data as unknown as DigitalTwinNode);
  };

  // Filter visible nodes
  const filteredNodes = useMemo(() => {
    if (filterType === 'all') return nodes;
    return nodes.filter((n) => (n.data as unknown as DigitalTwinNode).type === filterType);
  }, [nodes, filterType]);

  const handleSimulateDisruptionOnNode = (node: DigitalTwinNode) => {
    soundFX.playClick();
    runSimulation({
      scenarioName: `Disruption Simulation: ${node.label}`,
      disruptionType: 'supplier_bankruptcy',
      targetEntityId: node.id,
      targetEntityName: node.label,
      targetType: node.type,
      durationDays: 21,
      severityPct: 80,
      includeSecondTierCascade: true,
      autoMitigate: true,
    });
    onNavigate('simulation-results');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">
              Global Supply Chain Digital Twin
            </h2>
            <NeonBadge variant="blue" size="sm">
              LIVE GRAPH
            </NeonBadge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time topology model mapping 248 multi-tier entities, lead-time velocity, and material bottlenecks.
          </p>
        </div>

        {/* Quick Node Type Filter Bar */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-white/10 overflow-x-auto">
          {[
            { id: 'all', label: 'All Nodes' },
            { id: 'tier2_supplier', label: 'Tier-2 Fabs' },
            { id: 'tier1_supplier', label: 'Tier-1 Assembly' },
            { id: 'factory', label: 'Gigafactories' },
            { id: 'port', label: 'Ports' },
            { id: 'warehouse', label: 'Hubs' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                soundFX.playClick();
                setFilterType(item.id);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                filterType === item.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Canvas & Inspector Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[680px]">
        {/* React Flow Graph Area */}
        <div className={`rounded-2xl glass-panel border border-white/10 overflow-hidden relative ${selectedNode ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
          <ReactFlow
            nodes={filteredNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
            className="bg-slate-950/70"
          >
            <Background color="#3b82f6" gap={20} size={1} variant={BackgroundVariant.Dots} className="opacity-20" />
            <Controls className="bg-slate-900/90 border border-white/10 fill-white rounded-xl text-white shadow-xl" />
            <MiniMap
              nodeColor={(n) => {
                const data = n.data as unknown as DigitalTwinNode;
                if (data.status === 'critical') return '#ef4444';
                if (data.status === 'warning') return '#f59e0b';
                return '#3b82f6';
              }}
              className="rounded-xl border border-white/10 bg-slate-900/90 shadow-2xl"
              maskColor="rgba(15, 23, 42, 0.7)"
            />
          </ReactFlow>

          {/* Floating Instructions */}
          <div className="absolute top-4 left-4 z-10 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-slate-300 backdrop-blur-md">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>Click any node to inspect telemetry or simulate localized disruptions</span>
          </div>
        </div>

        {/* Node Inspector Side Panel */}
        {selectedNode && (
          <div className="lg:col-span-1 rounded-2xl glass-panel border border-blue-500/40 p-5 flex flex-col justify-between overflow-y-auto space-y-4 shadow-2xl">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-sm font-bold text-white font-display">{selectedNode.label}</h3>
                  <p className="text-xs text-slate-400 capitalize">{selectedNode.country} • {selectedNode.type?.replace('_', ' ')}</p>
                </div>
                <NeonBadge variant={selectedNode.status} size="sm">
                  {selectedNode.status.toUpperCase()}
                </NeonBadge>
              </div>

              {/* Node Telemetry Metrics */}
              <div className="mt-4 space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Capacity Load:</span>
                    <span className="font-semibold text-white font-mono-telemetry">{selectedNode.capacityUtilization || 85}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Average Lead Time:</span>
                    <span className="font-semibold text-slate-200 font-mono-telemetry">{selectedNode.leadTimeDays || 7} Days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vulnerability Risk:</span>
                    <span className={`font-semibold font-mono-telemetry ${(selectedNode.riskScore || 0) > 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {selectedNode.riskScore || 20} / 100
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-1">
                  <div className="flex items-center gap-1.5 text-purple-300 font-semibold text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>AI Autonomous Insight</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {selectedNode.status === 'optimal'
                      ? 'Node operating at peak efficiency. Buffer levels sufficient for 45 days forward demand.'
                      : 'High capacity pressure detected. Dual-sourcing or safety buffer expansion recommended.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 pt-3 border-t border-white/10">
              <Button
                variant="glow"
                size="sm"
                className="w-full"
                leftIcon={<Play className="w-3.5 h-3.5" />}
                onClick={() => handleSimulateDisruptionOnNode(selectedNode)}
              >
                Inject Disruption Scenario
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => setSelectedNode(null)}
              >
                Close Inspector
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
