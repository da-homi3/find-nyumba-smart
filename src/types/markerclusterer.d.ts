declare module "@googlemaps/markerclusterer" {
  import type { Marker } from "google.maps";

  export interface Cluster {
    count: number;
    position: google.maps.LatLng;
    markers?: Marker[];
  }

  export interface Renderer {
    render: (cluster: Cluster, stats: unknown, map: google.maps.Map) => Marker;
  }

  export interface AlgorithmOptions {
    radius?: number;
    maxZoom?: number;
  }

  export class SuperClusterAlgorithm {
    constructor(options?: AlgorithmOptions);
  }

  export class MarkerClusterer {
    constructor(options: {
      map: google.maps.Map;
      markers: Marker[];
      algorithm?: SuperClusterAlgorithm;
      renderer?: Renderer;
    });
    clearMarkers(): void;
    addMarkers(markers: Marker[]): void;
  }
}
