import React, { useState, useRef, useEffect } from 'react';
import { SpacingObject, ToolMode, SelectionState, Measure } from '../../types/score';

interface PageSpacingLayerProps {
  pageIndex: number;
  pageWidth: number;
  staffMarginLeft: number;
  staffMarginRight: number;
  systems: Array<{
    systemIndex: number;
    measures: Array<{
      measure: Measure;
      measureIdx: number;
      width: number;
    }>;
  }>;
  systemPositions: Array<{
    globalSysIdx: number;
    systemY: number;
    measureBlockHeight: number;
    extraSpace: number;
    lastMeasure: Measure;
  }>;
  spacingObjects: SpacingObject[];
  selection: SelectionState;
  toolMode: ToolMode;
  onSelectSpace?: (spaceId: string) => void;
  onAddSpace?: (afterMeasureId: string, amount: number, systemIndex: number) => void;
  onUpdateSpace?: (spaceId: string, patch: Partial<SpacingObject>) => void;
  onDeleteSpace?: (spaceId: string) => void;
  isPrintView?: boolean;
}

export const PageSpacingLayer: React.FC<PageSpacingLayerProps> = ({
  pageIndex,
  pageWidth,
  staffMarginLeft,
  staffMarginRight,
  systemPositions,
  spacingObjects,
  selection,
  toolMode,
  onSelectSpace,
  onAddSpace,
  onUpdateSpace,
  onDeleteSpace,
  isPrintView = false,
}) => {
  // Active dragging handle state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const dragRef = useRef<{
    id: string;
    startY: number;
    initialAmount: number;
  } | null>(null);

  // Mousemove and mouseup listeners for interactive drag-resizing of vertical space
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const deltaY = e.clientY - dragRef.current.startY;
      const newAmount = Math.max(0, Math.min(400, Math.round(dragRef.current.initialAmount + deltaY)));
      onUpdateSpace?.(dragRef.current.id, { amount: newAmount });
    };

    const handleMouseUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        setActiveDragId(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onUpdateSpace]);

  if (isPrintView) {
    // In print/PDF output, do not render editor handles/badges — only the pure layout space
    return null;
  }

  const usableWidth = pageWidth - staffMarginLeft - staffMarginRight;

  return (
    <g className="pianotastic-spacing-layer" pointerEvents="all">
      {systemPositions.map((pos, idx) => {
        const { globalSysIdx, systemY, measureBlockHeight, extraSpace, lastMeasure } = pos;
        const matchingSpace = spacingObjects.find(
          (s) => s.afterMeasureId === lastMeasure.id || s.systemIndex === globalSysIdx
        );
        const isSelected =
          selection.selectionType === 'space' &&
          matchingSpace &&
          selection.spacingObjectId === matchingSpace.id;

        const isLastSystemOnPage = idx === systemPositions.length - 1;
        const topY = systemY + measureBlockHeight;
        const height = extraSpace > 0 ? extraSpace : 28;

        return (
          <g key={`space-zone-p${pageIndex}-sys${globalSysIdx}-m${lastMeasure.id}`}>
            {matchingSpace ? (
              // An existing Spacing Object between systems
              <g
                className={`spacing-object-group ${isSelected ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSpace?.(matchingSpace.id);
                }}
              >
                {/* Background tint when Space tool active or selected */}
                {(toolMode === 'space' || isSelected) && (
                  <rect
                    x={staffMarginLeft}
                    y={topY}
                    width={usableWidth}
                    height={Math.max(16, matchingSpace.amount)}
                    fill={isSelected ? 'rgba(2, 132, 199, 0.08)' : 'rgba(245, 158, 11, 0.05)'}
                    stroke={isSelected ? '#0284c7' : '#f59e0b'}
                    strokeWidth={isSelected ? 1.5 : 1}
                    strokeDasharray={isSelected ? 'none' : '4 3'}
                    rx={4}
                    className="cursor-pointer transition-colors"
                  />
                )}

                {/* Center Badge & Handle */}
                {(toolMode === 'space' || isSelected || activeDragId === matchingSpace.id) && (
                  <g transform={`translate(${pageWidth / 2}, ${topY + Math.max(16, matchingSpace.amount) / 2})`}>
                    {/* Pill Background */}
                    <rect
                      x={-60}
                      y={-12}
                      width={120}
                      height={24}
                      rx={12}
                      fill={isSelected ? '#0284c7' : '#0f172a'}
                      className="shadow-sm cursor-pointer"
                    />

                    {/* Badge text */}
                    <text
                      x={0}
                      y={4}
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="'Plus Jakarta Sans', sans-serif"
                      textAnchor="middle"
                      className="pointer-events-none select-none"
                    >
                      ↕ {matchingSpace.amount} px
                    </text>

                    {/* Quick Stepper: [-] Button */}
                    <g
                      transform="translate(-46, 0)"
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = Math.max(0, matchingSpace.amount - 5);
                        onUpdateSpace?.(matchingSpace.id, { amount: next });
                      }}
                    >
                      <circle cx={0} cy={0} r={7} fill="rgba(255,255,255,0.2)" />
                      <text x={0} y={3.5} fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">
                        -
                      </text>
                    </g>

                    {/* Quick Stepper: [+] Button */}
                    <g
                      transform="translate(46, 0)"
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = Math.min(400, matchingSpace.amount + 5);
                        onUpdateSpace?.(matchingSpace.id, { amount: next });
                      }}
                    >
                      <circle cx={0} cy={0} r={7} fill="rgba(255,255,255,0.2)" />
                      <text x={0} y={3.5} fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">
                        +
                      </text>
                    </g>
                  </g>
                )}

                {/* Interactive Drag Handle along the bottom border of the space */}
                {(toolMode === 'space' || isSelected) && (
                  <g
                    transform={`translate(${staffMarginLeft}, ${topY + matchingSpace.amount})`}
                    className="cursor-ns-resize"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      dragRef.current = {
                        id: matchingSpace.id,
                        startY: e.clientY,
                        initialAmount: matchingSpace.amount,
                      };
                      setActiveDragId(matchingSpace.id);
                      onSelectSpace?.(matchingSpace.id);
                    }}
                  >
                    <line
                      x1={0}
                      y1={0}
                      x2={usableWidth}
                      y2={0}
                      stroke={isSelected ? '#0284c7' : '#cbd5e1'}
                      strokeWidth={isSelected ? 2 : 1.5}
                      strokeDasharray="2 2"
                    />
                    {/* Small grip dot */}
                    <circle cx={usableWidth / 2} cy={0} r={3.5} fill={isSelected ? '#0284c7' : '#94a3b8'} />
                  </g>
                )}
              </g>
            ) : (
              /* No space yet below this system: Show "+ Add Space" insert zone when Space Tool is active */
              toolMode === 'space' &&
              !isLastSystemOnPage && (
                <g
                  className="space-insert-zone cursor-pointer group"
                  transform={`translate(0, ${topY + 6})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddSpace?.(lastMeasure.id, 30, globalSysIdx);
                  }}
                >
                  <line
                    x1={staffMarginLeft}
                    y1={0}
                    x2={pageWidth - staffMarginRight}
                    y2={0}
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    opacity="0.6"
                    className="group-hover:stroke-sky-500 group-hover:opacity-100 transition-opacity"
                  />
                  <g transform={`translate(${pageWidth / 2}, 0)`}>
                    <rect
                      x={-45}
                      y={-10}
                      width={90}
                      height={20}
                      rx={10}
                      fill="#ffffff"
                      stroke="#0284c7"
                      strokeWidth="1"
                      className="group-hover:fill-sky-50 transition-colors shadow-2xs"
                    />
                    <text
                      x={0}
                      y={3.5}
                      fill="#0284c7"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="'Plus Jakarta Sans', sans-serif"
                      textAnchor="middle"
                      className="pointer-events-none select-none"
                    >
                      + Add Space
                    </text>
                  </g>
                </g>
              )
            )}
          </g>
        );
      })}
    </g>
  );
};
