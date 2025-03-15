import React, { useState, useEffect } from 'react';
import { ValidatePlugins } from '../../wailsjs/go/main/App';
interface PluginValidationResult {
    pluginPath: string;
    isValid: boolean;
    hasManifest: boolean;
    hasContent: boolean;
    hasBackground: boolean;
    hasIcon: boolean;
    errors: string[];
    manifest?: any;
}
export const PluginDiagnostic: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [validationResults, setValidationResults] = useState<PluginValidationResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [fileDetails, setFileDetails] = useState<Record<string, string[]>>({});

    const runDiagnostic = async () => {
        try {
            setIsLoading(true);
            const results = await ValidatePlugins();
            setValidationResults(results);


            const details: Record<string, string[]> = {};

            for (const result of results) {
                try {
                    if (typeof window !== 'undefined' && window.go && window.go.main && window.go.main.App) {

                        const entries = await window.go.main.App.ListPluginEntries(result.pluginPath);
                        const files: string[] = [];


                        for (const entry of entries) {
                            if (entry.isDirectory) {

                                try {
                                    const subEntries = await window.go.main.App.ListPluginEntries(`${result.pluginPath}/${entry.name}`);
                                    for (const subEntry of subEntries) {
                                        files.push(`${entry.name}/${subEntry.name}${subEntry.isDirectory ? '/' : ''}`);
                                    }
                                } catch (error) {
                                    files.push(`${entry.name}/`);
                                }
                            } else {
                                files.push(entry.name);
                            }
                        }

                        details[result.pluginPath] = files;
                    }
                } catch (error) {
                    console.error('Failed to get file details:', error);
                }
            }

            setFileDetails(details);
            setIsLoading(false);
        } catch (error) {
            console.error('Failed to validate plugins:', error);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        runDiagnostic();
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.key === 'd') {
                setIsOpen(!isOpen);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);
    if (!isOpen) {
        return null;
    }
    return (
        <div
            className="clickable"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                zIndex: 2000,
                display: 'flex',
                flexDirection: 'column',
                padding: '20px',
                color: 'white',
                overflow: 'auto',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Plugin Diagnostic (Alt+D)</h2>
                <button
                    style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: 'white',
                        fontSize: '24px',
                        cursor: 'pointer',
                    }}
                    onClick={() => setIsOpen(false)}
                >
                    ✕
                </button>
            </div>
            <div style={{ display: 'flex', marginBottom: '20px' }}>
                <button
                    style={{
                        backgroundColor: '#4299e1',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginRight: '10px',
                    }}
                    onClick={runDiagnostic}
                    disabled={isLoading}
                >
                    {isLoading ? 'Running...' : 'Run Diagnostic'}
                </button>
            </div>
            {isLoading ? (
                <div>Loading...</div>
            ) : (
                <div>
                    <h3>Plugin Validation Results:</h3>
                    {validationResults.length === 0 ? (
                        <div>No plugins found</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {validationResults.map((result, index) => (
                                <div
                                    key={index}
                                    style={{
                                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                        padding: '15px',
                                        borderRadius: '8px',
                                        borderLeft: `4px solid ${result.isValid ? '#4ade80' : '#f87171'}`,
                                    }}
                                >
                                    <h4 style={{ marginTop: 0 }}>
                                        {result.manifest?.name || 'Unknown Plugin'}{' '}
                                        {result.isValid ? '✅' : '❌'}
                                    </h4>
                                    <div style={{ marginBottom: '8px' }}>
                                        Path: <code>{result.pluginPath}</code>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                                        <div style={{
                                            backgroundColor: result.hasManifest ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)',
                                            padding: '4px 8px',
                                            borderRadius: '4px'
                                        }}>
                                            Manifest: {result.hasManifest ? '✓' : '✗'}
                                        </div>
                                        <div style={{
                                            backgroundColor: result.hasContent ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)',
                                            padding: '4px 8px',
                                            borderRadius: '4px'
                                        }}>
                                            Content: {result.hasContent ? '✓' : '✗'}
                                        </div>
                                        <div style={{
                                            backgroundColor: result.hasBackground ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)',
                                            padding: '4px 8px',
                                            borderRadius: '4px'
                                        }}>
                                            Background: {result.hasBackground ? '✓' : '✗'}
                                        </div>
                                        <div style={{
                                            backgroundColor: result.hasIcon ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)',
                                            padding: '4px 8px',
                                            borderRadius: '4px'
                                        }}>
                                            Icon: {result.hasIcon ? '✓' : '✗'}
                                        </div>
                                    </div>

                                    {/* ファイル構造表示 */}
                                    {fileDetails[result.pluginPath] && (
                                        <div style={{ marginBottom: '10px' }}>
                                            <h5 style={{ marginBottom: '5px' }}>Directory Contents:</h5>
                                            <div style={{
                                                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                                padding: '10px',
                                                borderRadius: '4px',
                                                overflow: 'auto',
                                                maxHeight: '200px',
                                                fontFamily: 'monospace'
                                            }}>
                                                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                                    {fileDetails[result.pluginPath].map((file, i) => (
                                                        <li key={i} style={{
                                                            color:
                                                                file.endsWith('.ts') ? '#60a5fa' :
                                                                    file.endsWith('.js') ? '#7dd3fc' :
                                                                        file.endsWith('.json') ? '#f59e0b' :
                                                                            file.endsWith('/') ? '#10b981' :
                                                                                file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.gif') ? '#ec4899' :
                                                                                    'white'
                                                        }}>
                                                            {file}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {result.manifest && (
                                        <div style={{ marginBottom: '10px' }}>
                                            <h5 style={{ marginBottom: '5px' }}>Manifest:</h5>
                                            <pre style={{
                                                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                                padding: '10px',
                                                borderRadius: '4px',
                                                overflow: 'auto',
                                                maxHeight: '200px'
                                            }}>
                                                {JSON.stringify(result.manifest, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                    {result.errors.length > 0 && (
                                        <div>
                                            <h5 style={{ color: '#f87171', marginBottom: '5px' }}>Errors:</h5>
                                            <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                                {result.errors.map((error, i) => (
                                                    <li key={i}>{error}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};