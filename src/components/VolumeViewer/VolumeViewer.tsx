import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import { RenderingEngine, cache } from '@cornerstonejs/core';
import { ToolGroupManager } from '@cornerstonejs/tools';

import { TOOL_GROUP_ID } from './constants';
import { CURSOR_STYLES } from './cursors';
import { initCornerstone } from './initCornerstone';
import { createVolumeViewport, updateViewportPreset } from './volumeRenderer';

/**
 * 3D Volume Viewer component for rendering DICOM image stacks.
 * Supports rotation, pan, and zoom with mouse and keyboard shortcuts.
 */
export default function VolumeViewer() {
    const elementRef = useRef<HTMLDivElement>(null);
    const renderingEngineRef = useRef<RenderingEngine | null>(null);
    const [status, setStatus] = useState('Idle');
    const [cursorStyle, setCursorStyle] = useState<string>(CURSOR_STYLES.default);
    const presetOptions = cornerstone.CONSTANTS.VIEWPORT_PRESETS.map(preset => preset.name);
    const [selectedPreset, setSelectedPreset] = useState<string>(
        presetOptions.includes('CT-AAA') ? 'CT-AAA' : presetOptions[0] || 'CT-AAA'
    );

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.shiftKey) {
            setCursorStyle(CURSOR_STYLES.panActive);
        } else if (e.ctrlKey) {
            setCursorStyle(CURSOR_STYLES.zoomActive);
        } else if (e.button === 0) {
            setCursorStyle(CURSOR_STYLES.rotate);
        } else if (e.button === 1) {
            setCursorStyle(CURSOR_STYLES.panActive);
        } else if (e.button === 2) {
            setCursorStyle(CURSOR_STYLES.zoomActive);
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        setCursorStyle(CURSOR_STYLES.default);
    }, []);

    useEffect(() => {
        initCornerstone().catch(console.error);
        return () => {
            renderingEngineRef.current?.destroy();
            ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID);
            cache.purgeCache();
        };
    }, []);

    useEffect(() => {
        updateViewportPreset(renderingEngineRef.current, selectedPreset);
    }, [selectedPreset]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        setStatus('Loading volume...');

        const fileObjects = Array.from(files).map(file => ({
            file,
            num: parseInt(file.name.match(/\d+/)?.[0] || '0')
        }));
        fileObjects.sort((a, b) => a.num - b.num);

        const objectUrls = fileObjects.map(obj => URL.createObjectURL(obj.file));
        const imageIds = objectUrls.map(url => `wadouri:${url}`);

        try {
            if (!elementRef.current) return;
            renderingEngineRef.current?.destroy();
            renderingEngineRef.current = await createVolumeViewport(
                elementRef.current,
                imageIds,
                selectedPreset
            );
            setStatus('Ready');
        } catch (e) {
            console.error(e);
            setStatus('Error');
        } finally {
            objectUrls.forEach(url => URL.revokeObjectURL(url));
        }
    };

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 12, background: '#111', color: '#fff', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center' }}>
                <label style={{ padding: '8px 16px', background: '#007bff', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>
                    UPLOAD DICOM FOLDER
                    {/* @ts-expect-error Non-standard attribute for folder upload */}
                    <input type="file" multiple webkitdirectory="true" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>

                <label style={{ marginLeft: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#ddd' }}>
                    Preset
                    <select
                        value={selectedPreset}
                        onChange={(e) => setSelectedPreset(e.target.value)}
                        style={{
                            background: '#1b1b1b',
                            color: '#fff',
                            border: '1px solid #333',
                            borderRadius: 4,
                            padding: '8px 10px',
                        }}
                    >
                        {presetOptions.map((presetName) => (
                            <option key={presetName} value={presetName}>
                                {presetName}
                            </option>
                        ))}
                    </select>
                </label>
                <span style={{ marginLeft: 20, color: '#aaa' }}>{status}</span>
                <div style={{ color: '#aaa', fontSize: '12px', fontFamily: 'sans-serif', marginLeft: 'auto' }}>
                    Rotate: Left Click + Drag &nbsp;|&nbsp; Pan: Middle or Shift + Click + Drag &nbsp;|&nbsp; Zoom: Right or Ctrl + Click + Drag
                </div>
            </div>

            <div
                ref={elementRef}
                style={{
                    flex: 1,
                    background: '#000',
                    touchAction: 'none',
                    pointerEvents: 'auto',
                    cursor: cursorStyle,
                }}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={e => e.preventDefault()}
            />
        </div>
    );
}
