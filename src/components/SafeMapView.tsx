import { Component, type ErrorInfo, type ReactNode, type ComponentProps } from 'react';
import MapView from './MapView';

type MapViewProps = ComponentProps<typeof MapView>;

interface State {
  error: Error | null;
}

class MapErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MapErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="map-fallback">
          <p>Map unavailable.</p>
          <small>{this.state.error.message}</small>
          <pre className="map-fallback-stack">{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SafeMapView(props: MapViewProps) {
  return (
    <MapErrorBoundary>
      <MapView {...props} />
    </MapErrorBoundary>
  );
}
