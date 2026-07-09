(() => {
  const panels = [...document.querySelectorAll("[data-live-research-record]")];
  if (!panels.length) return;

  const endpoint = "https://api.openalex.org/authors/https://orcid.org/0000-0002-9098-9419";
  const formatter = new Intl.NumberFormat();
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const setText = (selector, value) => {
    panels.forEach((panel) => {
      panel.querySelectorAll(selector).forEach((element) => {
        element.textContent = value;
      });
    });
  };

  const setStatus = (value, status) => {
    panels.forEach((panel) => {
      panel.dataset.liveRecordStatus = status;
      panel.querySelectorAll("[data-live-record-status]").forEach((element) => {
        element.textContent = value;
      });
    });
  };

  fetch(endpoint, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`OpenAlex request failed: ${response.status}`);
      return response.json();
    })
    .then((record) => {
      const citations = Number(record.cited_by_count);
      const works = Number(record.works_count);
      if (!Number.isFinite(citations) || !Number.isFinite(works)) {
        throw new Error("OpenAlex returned an incomplete record");
      }

      setText("[data-live-citations]", formatter.format(citations));
      setText("[data-live-works]", formatter.format(works));

      const updated = record.updated_date ? new Date(`${record.updated_date}Z`) : null;
      const status = updated && !Number.isNaN(updated.valueOf())
        ? `OpenAlex record updated ${dateFormatter.format(updated)}.`
        : "Live record loaded from OpenAlex.";
      setStatus(status, "ready");
    })
    .catch(() => {
      setText("[data-live-citations]", "--");
      setText("[data-live-works]", "--");
      setStatus("Live data is temporarily unavailable. Use the source profiles below.", "unavailable");
    });
})();
