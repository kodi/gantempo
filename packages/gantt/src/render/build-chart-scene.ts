import type { BuildChartSceneOptions, ChartScene } from './primitives';
import { createChartScenePipeline } from './scene-pipeline';

/**
 * Composes the pure M3 kernels and translates only queried layout into semantic
 * primitives; relationship lookup, stacking, and visibility remain outside React.
 */
export function buildChartScene(options: BuildChartSceneOptions): ChartScene {
  return createChartScenePipeline().build(options).scene;
}
