import './style.css';
import {apply, recordStyleLayer} from 'ol-mapbox-style';
import { Link } from 'ol/interaction';
import { Attribution, defaults } from 'ol/control';
import { useGeographic } from 'ol/proj';
import VectorTileLayer from 'ol/layer/VectorTile';
import { Fill, Style } from 'ol/style';
import { Map } from 'ol';
import { register as registerPMTilesProtocol } from 'pmtiles-protocol';

registerPMTilesProtocol();

const STYLE_URL = './data/style.json';

const style = new Style({
  fill: new Fill({
    color: 'rgba(0, 0, 0, 0.1)'
  }),
});

useGeographic();
recordStyleLayer(true);

(async () => {
  const map = new Map({
    target: 'map',
    controls: defaults({attribution: false})
  });
  await apply(map, STYLE_URL);
  map.getView().fit([8.782379, 46.358770, 17.5, 49.037872]);
  map.addInteraction(new Link());
  map.addControl(new Attribution({
    collapsible: false,
    attributions: [
      'Grundkarte: <a href="https://www.basemap.at">basemap.at</a>',
      'ÖROK-Monitoring Flächeninanspruchnahme und Versiegelung (2022); Bearbeitung: <a href="https://www.umweltbundesamt.at">Umweltbundesamt GmbH</a>',
      'Datenquelle: Statistik Austria - <a href="https://data.statistik.gv.at">data.statistik.gv.at</a>'
    ]
  }));

  let ids = [];
  const selection = new VectorTileLayer({
    renderMode: 'vector',
    source: map.getLayers().getArray().find(l => l instanceof VectorTileLayer).getSource(),
    style: (feature) => ids.includes(feature.getId()) ? style : null,
  });
  map.addLayer(selection);

  const container = map.getTargetElement();
  map.on('pointermove', (evt) => {
    if (evt.dragging) {
      return;
    }
    const hit = map.getFeaturesAtPixel(
      evt.pixel,
      {layerFilter: layer => layer !== selection});
      const newIds = [...new Set(hit.map(f => f.getId()))];
    newIds.sort();
    if (ids.toString() === newIds.toString()) {
      return;
    }
    ids = newIds;
    selection.changed();
    if (!hit.length) {
      container.title = '';
      return;
    }
    const sourceLayer = hit[0].get('mapbox-layer')?.id;
    const title = sourceLayer === 'Orientierungsraster'
      ? Math.round(hit[0].get('area') / 1000000) + ' % beansprucht'
      : sourceLayer;
      container.title = title;
  });

  map.on('moveend', () => {
    if (map.getView().getZoom() < 11) {
      map.once('click', (event) => map.getView().animate({zoom: 11, center: event.coordinate}));
    }
  })
})();
