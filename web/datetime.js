(function (global) {
  function getProfileTimezone(profile) {
    if (profile?.timezone) {
      return profile.timezone;
    }
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  function getTimezoneOffsetMs(utcInstant, timeZone) {
    const d = utcInstant instanceof Date ? utcInstant : new Date(utcInstant);
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
        .formatToParts(d)
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, p.value]),
    );
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    return asUtc - d.getTime();
  }

  function datetimeLocalToUtcIso(datetimeLocal, timeZone) {
    const [datePart, timePart] = datetimeLocal.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm] = timePart.split(':').map(Number);
    const localAsUtcMs = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
    let utcMs = localAsUtcMs;
    for (let i = 0; i < 4; i++) {
      utcMs = localAsUtcMs - getTimezoneOffsetMs(new Date(utcMs), timeZone);
    }
    return new Date(utcMs).toISOString();
  }

  function nowForDatetimeLocal(timeZone) {
    const now = new Date();
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
        .formatToParts(now)
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function formatDisplayDate(isoUtc, timeZone) {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      dateStyle: 'medium',
    }).format(new Date(isoUtc));
  }

  function formatDisplayDateTime(isoUtc, timeZone) {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(isoUtc));
  }

  function populateTimezoneDatalist(datalistEl) {
    if (!datalistEl || datalistEl.childElementCount > 0) {
      return;
    }
    if (typeof Intl.supportedValuesOf !== 'function') {
      return;
    }
    for (const zone of Intl.supportedValuesOf('timeZone')) {
      const option = document.createElement('option');
      option.value = zone;
      datalistEl.appendChild(option);
    }
  }

  global.WeightTrackerDateTime = {
    getProfileTimezone,
    datetimeLocalToUtcIso,
    nowForDatetimeLocal,
    formatDisplayDate,
    formatDisplayDateTime,
    populateTimezoneDatalist,
  };
})(window);
