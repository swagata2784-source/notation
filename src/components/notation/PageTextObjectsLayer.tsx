import React, { useState, useEffect, useRef } from 'react';
import { ScoreTextAnnotation, ToolMode } from '../../types/score';

interface PageTextObjectsLayerProps {
  pageIndex: number;
  pageWidth: number;
  pageHeight: number;
  zoom: number;
  isPrintView?: boolean;
  textObjects: ScoreTextAnnotation[];
  selectedTextAnnotationId?: string | null;
  toolMode: ToolMode;
  onSelectTextAnnotation?: (id: string) => void;
  onEditTextAnnotation?: (textAnnotation: ScoreTextAnnotation) => void;
  onMoveTextAnnotation?: (id: string, x: number, y: number) => void;
  onCommitMoveTextAnnotation?: (id: string, x: number, y: number) => void;
  onUpdateTextAnnotation?: (id: string, patch: Partial<ScoreTextAnnotation>) => void;
  onDeleteTextAnnotation?: (id: string) => void;
}

export const PageTextObjectsLayer: React.FC<PageTextObjectsLayerProps> = ({
  pageIndex,
  pageWidth,
  pageHeight,
  zoom,
  isPrintView = false,
  textObjects,
  selectedTextAnnotationId,
  toolMode,
  onSelectTextAnnotation,
  onEditTextAnnotation,
  onMoveTextAnnotation,
  onCommitMoveTextAnnotation,
  onUpdateTextAnnotation,
  onDeleteTextAnnotation,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Active drag state
  const draggingRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Active resize state
  const resizingRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    initialFontSize: number;
    initialWidth: number;
  } | null>(null);

  // Filter text objects belonging to this page (defaulting unassigned to page 0)
  const pageItems = textObjects.filter((item) => {
    const itemPage = item.pageIndex !== undefined ? item.pageIndex : 0;
    return itemPage === pageIndex;
  });

  // Global mouse handlers for fluid dragging
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (draggingRef.current) {
        const drag = draggingRef.current;
        const dx = (e.clientX - drag.startX) / zoom;
        const dy = (e.clientY - drag.startY) / zoom;
        const newX = Math.round(Math.max(10, Math.min(pageWidth - 20, drag.initialX + dx)));
        const newY = Math.round(Math.max(14, Math.min(pageHeight - 10, drag.initialY + dy)));
        drag.currentX = newX;
        drag.currentY = newY;
        onMoveTextAnnotation?.(drag.id, newX, newY);
      } else if (resizingRef.current) {
        const resize = resizingRef.current;
        const dy = (e.clientY - resize.startY) / zoom;
        const dx = (e.clientX - resize.startX) / zoom;
        const newFontSize = Math.max(8, Math.min(72, Math.round(resize.initialFontSize + dy * 0.4)));
        const newWidth = Math.max(30, Math.round(resize.initialWidth + dx));
        onUpdateTextAnnotation?.(resize.id, {
          fontSize: newFontSize,
          width: newWidth,
        });
      }
    };

    const handleWindowMouseUp = () => {
      if (draggingRef.current) {
        const drag = draggingRef.current;
        onCommitMoveTextAnnotation?.(drag.id, drag.currentX, drag.currentY);
        draggingRef.current = null;
      }
      if (resizingRef.current) {
        resizingRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [zoom, pageWidth, pageHeight, onMoveTextAnnotation, onCommitMoveTextAnnotation, onUpdateTextAnnotation]);

  if (pageItems.length === 0) {
    return null;
  }

  return (
    <g className="score-page-text-layer" id={`page-${pageIndex + 1}-text-layer`}>
      {pageItems.map((textObj) => {
        const isSelected = selectedTextAnnotationId === textObj.id;
        const isHovered = hoveredId === textObj.id;

        // Position coordinates
        const x = textObj.x !== undefined ? textObj.x : 100;
        const y = textObj.y !== undefined ? textObj.y : 100;
        const fontSize = textObj.fontSize || 14;
        const isBold = textObj.fontWeight === 'bold';
        const isItalic = textObj.fontStyle === 'italic';
        const isUnderline = textObj.textDecoration === 'underline';
        const textAlign = textObj.textAlign || 'left';
        const textColor = textObj.color || '#0f172a';
        const textContent = textObj.text || textObj.content || '';

        const textAnchor =
          textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start';

        // Approximate dimensions for interaction box
        const approxCharWidth = fontSize * 0.58;
        const computedWidth = Math.max(32, textContent.length * approxCharWidth + 12);
        const boxWidth = textObj.width || computedWidth;
        const boxHeight = textObj.height || Math.max(22, fontSize + 8);

        let boxLeft = x - 4;
        if (textAnchor === 'middle') {
          boxLeft = x - boxWidth / 2;
        } else if (textAnchor === 'end') {
          boxLeft = x - boxWidth + 4;
        }
        const boxTop = y - fontSize + 2;

        return (
          <g
            key={textObj.id}
            id={`text-object-${textObj.id}`}
            className="group/textobj select-none"
            onMouseEnter={() => !isPrintView && setHoveredId(textObj.id)}
            onMouseLeave={() => !isPrintView && setHoveredId(null)}
          >
            {/* Interactive backdrop / selection highlight (Hidden during print) */}
            {!isPrintView && (
              <rect
                x={boxLeft}
                y={boxTop}
                width={boxWidth}
                height={boxHeight}
                rx={3}
                fill={
                  isSelected
                    ? 'rgba(59, 130, 246, 0.12)'
                    : isHovered
                    ? 'rgba(59, 130, 246, 0.05)'
                    : 'transparent'
                }
                stroke={isSelected ? '#2563eb' : isHovered ? '#93c5fd' : 'transparent'}
                strokeWidth={isSelected ? 1.5 : 1}
                strokeDasharray={isSelected ? '4 2' : 'none'}
                className={toolMode === 'eraser' ? 'cursor-pointer' : 'cursor-move'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (toolMode === 'eraser') {
                    onDeleteTextAnnotation?.(textObj.id);
                    return;
                  }
                  onSelectTextAnnotation?.(textObj.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onEditTextAnnotation?.(textObj);
                }}
                onMouseDown={(e) => {
                  if (toolMode === 'eraser') return;
                  if (e.button !== 0) return; // Left click only
                  e.stopPropagation();
                  onSelectTextAnnotation?.(textObj.id);
                  draggingRef.current = {
                    id: textObj.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialX: x,
                    initialY: y,
                    currentX: x,
                    currentY: y,
                  };
                }}
              />
            )}

            {/* Rendered Text Typography */}
            <text
              x={x}
              y={y}
              fontFamily="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              fontSize={fontSize}
              fontWeight={isBold ? 'bold' : 'normal'}
              fontStyle={isItalic ? 'italic' : 'normal'}
              textDecoration={isUnderline ? 'underline' : 'none'}
              textAnchor={textAnchor}
              fill={textColor}
              className={`select-none ${isPrintView ? 'pointer-events-none' : 'cursor-move'}`}
              onClick={(e) => {
                if (isPrintView) return;
                e.stopPropagation();
                if (toolMode === 'eraser') {
                  onDeleteTextAnnotation?.(textObj.id);
                  return;
                }
                onSelectTextAnnotation?.(textObj.id);
              }}
              onDoubleClick={(e) => {
                if (isPrintView) return;
                e.stopPropagation();
                onEditTextAnnotation?.(textObj);
              }}
              onMouseDown={(e) => {
                if (isPrintView || toolMode === 'eraser') return;
                if (e.button !== 0) return;
                e.stopPropagation();
                onSelectTextAnnotation?.(textObj.id);
                draggingRef.current = {
                  id: textObj.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  initialX: x,
                  initialY: y,
                  currentX: x,
                  currentY: y,
                };
              }}
            >
              {textContent}
            </text>

            {/* Selection Corner Handles & Resize Handle (Hidden during print) */}
            {!isPrintView && isSelected && (
              <g className="pointer-events-auto">
                {/* Top-Left */}
                <rect
                  x={boxLeft - 2.5}
                  y={boxTop - 2.5}
                  width={5}
                  height={5}
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth={1}
                />
                {/* Top-Right */}
                <rect
                  x={boxLeft + boxWidth - 2.5}
                  y={boxTop - 2.5}
                  width={5}
                  height={5}
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth={1}
                />
                {/* Bottom-Left */}
                <rect
                  x={boxLeft - 2.5}
                  y={boxTop + boxHeight - 2.5}
                  width={5}
                  height={5}
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth={1}
                />
                {/* Bottom-Right: Interactive Resize Handle */}
                <rect
                  x={boxLeft + boxWidth - 3.5}
                  y={boxTop + boxHeight - 3.5}
                  width={7}
                  height={7}
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  className="cursor-se-resize hover:scale-125 transition-transform"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    resizingRef.current = {
                      id: textObj.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      initialFontSize: fontSize,
                      initialWidth: boxWidth,
                    };
                  }}
                >
                  <title>Drag to resize text</title>
                </rect>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
};
