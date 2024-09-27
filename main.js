import './style.css';
import {apply, recordStyleLayer} from 'ol-mapbox-style';
import { Link } from 'ol/interaction';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { useGeographic } from 'ol/proj';
import { PMTiles } from 'pmtiles';

const STYLE_URL = './styles/Flächeninanspruchnahme_2022.json';

let styleUrl;
const pmtilesByUrl = {};
const tileUrlRegex = /^pmtiles:\/\/(.+)\/([0-9]+)\/([0-9]+)\/([0-9]+).mvt$/;
const tileCoordRegex = /\/([0-9]+)\/([0-9]+)\/([0-9]+).mvt$/;
export const transformRequest = async (url, type) => {
  if (type === 'Style') {
    styleUrl = url;
  };
  /** @type {PMTiles} */
  let pmtiles;
  if (url.startsWith('pmtiles://')) {
    const baseUrl = url.slice(10).replace(tileCoordRegex, '');
    if (!pmtilesByUrl[baseUrl]) {
      pmtilesByUrl[baseUrl] = new PMTiles(new URL(url.slice(10), styleUrl).href);
    }
    pmtiles = pmtilesByUrl[baseUrl];
  }
  if (!pmtiles) {
    return url;
  }
  if (type === 'Source') {
    const tileJson = await pmtiles.getTileJson(url);
    return `data:application/json,${encodeURIComponent(JSON.stringify(tileJson))}`;
  }
  if (type === 'Tiles') {
    const [, baseUrl, z, x, y] = url.match(tileUrlRegex);
    const tileResult = await pmtilesByUrl[baseUrl].getZxy(Number(z), Number(x), Number(y));
    const data = tileResult?.data ?? new ArrayBuffer(0);
    const objectUrl = URL.createObjectURL(new Blob([data]));
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    return objectUrl;
  }
  return url;
};

useGeographic();
recordStyleLayer(true);

(async () => {
  const map = await apply('map', STYLE_URL, {transformRequest});
  map.getView().fit([8.782379, 46.358770, 17.5, 49.037872]);
  map.addInteraction(new Link());

  const selection = new VectorSource({useSpatialIndex: false});
  map.addLayer(new VectorLayer({
    source: selection,
    style: {
      "stroke-color": "#000",
      "stroke-width": 2,
      "fill-color": "rgba(255, 0, 0, 0.1)",
    }
  }));

  map.on('pointermove', (evt) => {
    const container = map.getTargetElement();
    const hit = map.getFeaturesAtPixel(
      evt.pixel,
      {layerFilter: layer => layer.getSource() !== selection});
    if (hit.length) {
      container.style.cursor = 'pointer';
      container.title = hit.map(f => f.get('mapbox-layer').id).join(', ');
    } else {
      container.style.cursor = '';
      container.title = '';
    }
    selection.clear();
    selection.addFeatures(hit);
  });
})();
