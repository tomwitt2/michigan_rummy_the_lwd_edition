import React from 'react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
        this.setState({ errorInfo });
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '30px', fontFamily: 'Arial, sans-serif' }}>
                    <div style={{
                        background: '#fef2f2', border: '2px solid #e74c3c', borderRadius: '8px',
                        padding: '20px', maxWidth: '600px', margin: '0 auto',
                    }}>
                        <h2 style={{ color: '#c0392b', margin: '0 0 10px' }}>Something went wrong</h2>
                        <p style={{ color: '#333', margin: '0 0 10px' }}>
                            An error occurred while rendering the game. This can happen when interacting
                            with the game out of turn order via the debug panel.
                        </p>
                        <pre style={{
                            background: '#fff', border: '1px solid #ddd', borderRadius: '4px',
                            padding: '10px', fontSize: '12px', overflow: 'auto', maxHeight: '150px',
                            color: '#c0392b',
                        }}>{this.state.error?.message}{this.state.error?.stack && '\n\n' + this.state.error.stack}</pre>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                            style={{
                                marginTop: '12px', padding: '8px 20px', borderRadius: '6px', border: 'none',
                                background: '#3498db', color: 'white', cursor: 'pointer', fontSize: '14px',
                                fontWeight: 'bold',
                            }}
                        >Try to Recover</button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
