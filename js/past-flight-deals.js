(function () {
  'use strict';

  var list = document.getElementById('deal-list');
  var search = document.getElementById('deal-search');
  var cabin = document.getElementById('deal-cabin');
  var airline = document.getElementById('deal-airline');
  var reset = document.getElementById('deal-reset');
  var count = document.getElementById('deal-results-count');
  var empty = document.getElementById('deal-empty');
  if (!list || !search || !cabin || !airline || !count || !empty) return;

  var rows = Array.prototype.slice.call(list.querySelectorAll('[data-deal]'));
  var resetButtons = Array.prototype.slice.call(document.querySelectorAll('[data-reset-deals]'));

  function normalize(value) {
    return (value || '').trim().toLowerCase();
  }

  function applyFilters() {
    var query = normalize(search.value);
    var selectedCabin = cabin.value;
    var selectedAirline = airline.value;
    var visible = 0;

    rows.forEach(function (row) {
      var matchesQuery = !query || normalize(row.getAttribute('data-search')).indexOf(query) !== -1;
      var matchesCabin = selectedCabin === 'all' || row.getAttribute('data-cabin') === selectedCabin;
      var matchesAirline = selectedAirline === 'all' || row.getAttribute('data-airline') === selectedAirline;
      var isVisible = matchesQuery && matchesCabin && matchesAirline;
      row.hidden = !isVisible;
      if (isVisible) visible += 1;
    });

    count.textContent = visible + (visible === 1 ? ' historical arrangement' : ' historical arrangements');
    empty.hidden = visible !== 0;
  }

  function clearFilters() {
    search.value = '';
    cabin.value = 'all';
    airline.value = 'all';
    applyFilters();
    search.focus();
  }

  search.addEventListener('input', applyFilters);
  cabin.addEventListener('change', applyFilters);
  airline.addEventListener('change', applyFilters);
  reset.addEventListener('click', clearFilters);
  resetButtons.forEach(function (button) { button.addEventListener('click', clearFilters); });
  applyFilters();
})();
