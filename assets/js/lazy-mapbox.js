(function(){
  let promise = null;
  window.loadMapbox = function(){
    if (window.mapboxgl) return Promise.resolve(window.mapboxgl);
    if (promise) return promise;
    promise = new Promise((resolve,reject)=>{
      if (!document.querySelector('link[data-mapbox-css]')) {
        const link=document.createElement('link');
        link.rel='stylesheet';
        link.href='https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.css';
        link.dataset.mapboxCss='1';
        document.head.appendChild(link);
      }
      const script=document.createElement('script');
      script.src='https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.js';
      script.async=true;
      script.onload=()=>resolve(window.mapboxgl);
      script.onerror=()=>{promise=null;reject(new Error('Mapbox could not be loaded.'));};
      document.head.appendChild(script);
    });
    return promise;
  };
})();
