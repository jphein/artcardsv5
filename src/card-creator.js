import React, { useState, useMemo, useCallback } from "react";
import { castDream, divineName } from "./generate-api";
import { db, id } from "./db";
import { useCurrentUser } from "./auth-button";
import { v4 as uuidv4 } from "uuid";
import "./card-creator.css";

// ─── Constants ───

const DREAM_TYPES = [
  {
    key: "background",
    label: "Dreamscape",
    icon: "\u{1F30C}",
    prefix:
      "immersive atmospheric background for a therapeutic art collage, edge-to-edge composition with no central focal object, rich layered depth and luminous soft lighting, painterly textures blending watercolor washes with subtle grain, dreamlike and emotionally evocative, soft color transitions, gentle gradients of light and shadow that invite projection and contemplation \u2014 ",
  },
  {
    key: "element",
    label: "Element",
    icon: "\u2728",
    prefix:
      "clean digital illustration for collage cutout, complete subject fully visible, centered with generous empty space on all sides, plain solid white background, no shadows, no ground, sharp edges \u2014 ",
  },
  {
    key: "freeform",
    label: "Freeform",
    icon: "\u2726",
    prefix: "",
  },
  {
    key: "custom",
    label: "Custom",
    icon: "\u270E",
    prefix: "",
  },
];

const ESSENCES = [
  { key: "fairy-tale", label: "Fairy Tale", icon: "\u{1F9DA}", suffix: "fairy tale illustration style, whimsical and enchanting" },
  { key: "oil-painting", label: "Oil Painting", icon: "\u{1F3A8}", suffix: "oil painting style, rich impasto brushwork, classical technique" },
  { key: "anime", label: "Anime", icon: "\u2605", suffix: "anime art style, vibrant colors, expressive" },
  { key: "watercolor", label: "Watercolor", icon: "\u{1F4A7}", suffix: "watercolor painting style, soft washes, fluid pigment blending" },
  { key: "dark-fantasy", label: "Dark Fantasy", icon: "\u{1F319}", suffix: "dark fantasy art style, gothic atmosphere, dramatic lighting" },
  { key: "ethereal", label: "Ethereal", icon: "\u2727", suffix: "ethereal dreamy style, soft glow, otherworldly luminescence" },
  { key: "mythological", label: "Mythological", icon: "\u269B", suffix: "mythological art style, epic classical grandeur, symbolic imagery" },
];

const ASPECT_RATIOS = [
  { key: "1:1", label: "Square", size: "1024x1024", icon: "\u25A1" },
  { key: "3:2", label: "Landscape", size: "1536x1024", icon: "\u25AD" },
  { key: "2:3", label: "Portrait", size: "1024x1536", icon: "\u25AF" },
];

const PAGES = [
  { key: "vision", label: "Vision", icon: "\u{1F441}" },
  { key: "depths", label: "Depths", icon: "\u2693" },
  { key: "essences", label: "Essences", icon: "\u2748" },
  { key: "journal", label: "Journal", icon: "\u{1F4D6}" },
];

// ─── Component ───

function CardCreator({ onSwitchToTable, onCollectCard }) {
  const { user } = useCurrentUser();

  // Page state
  const [activePage, setActivePage] = useState("vision");

  // Dream Vision state
  const [prompt, setPrompt] = useState("");
  const [dreamType, setDreamType] = useState("background");
  const [customPrefix, setCustomPrefix] = useState("");

  // Dream Depths state
  const [model, setModel] = useState("flux-1.1-pro");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [quality, setQuality] = useState("standard");
  const [transparency, setTransparency] = useState(false);

  // Dream Essences state
  const [selectedEssences, setSelectedEssences] = useState(new Set());

  // Generation state
  const [isDreaming, setIsDreaming] = useState(false);
  const [dreamResult, setDreamResult] = useState(null);
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useState(false);

  // Journal state
  const [journalFilter, setJournalFilter] = useState("all");
  const [journalLightbox, setJournalLightbox] = useState(null);

  // Query user's creations for journal
  const creationsQuery = user
    ? { creations: { $: { where: { userId: user.id } } }, $files: {} }
    : null;
  const { data: creationsData } = db.useQuery(creationsQuery);
  const creations = creationsData?.creations || [];
  const creationFiles = creationsData?.$files || [];

  const fileUrlMap = useMemo(() => {
    const map = {};
    creationFiles.forEach((f) => {
      map[f.path] = f.url;
    });
    return map;
  }, [creationFiles]);

  const sortedCreations = useMemo(
    () => [...creations].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [creations]
  );

  const filteredCreations = useMemo(() => {
    if (journalFilter === "all") return sortedCreations;
    return sortedCreations.filter((c) => c.model === journalFilter || c.type === journalFilter);
  }, [sortedCreations, journalFilter]);

  // Auto-enable transparency for element type
  const effectiveTransparency = dreamType === "element" ? true : transparency;

  // Toggle essence selection
  const toggleEssence = useCallback((key) => {
    setSelectedEssences((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Build the full prompt
  const buildFullPrompt = useCallback(() => {
    const typeConfig = DREAM_TYPES.find((t) => t.key === dreamType);
    let prefix = typeConfig?.prefix || "";
    if (dreamType === "custom") {
      prefix = customPrefix ? customPrefix + " " : "";
    }

    const essenceSuffix = [...selectedEssences]
      .map((key) => {
        const e = ESSENCES.find((es) => es.key === key);
        return e ? e.suffix : "";
      })
      .filter(Boolean)
      .join(", ");

    let fullPrompt = prefix + prompt;
    if (essenceSuffix) {
      fullPrompt += ", " + essenceSuffix;
    }
    return fullPrompt;
  }, [prompt, dreamType, customPrefix, selectedEssences]);

  // ─── Casting Flow ───
  const handleDream = useCallback(async () => {
    if (!prompt.trim() || isDreaming || !user) return;

    setIsDreaming(true);
    setError(null);
    setDreamResult(null);

    try {
      // 1. Build prompt and size
      const fullPrompt = buildFullPrompt();
      const ratioConfig = ASPECT_RATIOS.find((r) => r.key === aspectRatio);
      const size = ratioConfig?.size || "1024x1024";

      // 2. Cast dream — generate image
      const castResult = await castDream({
        prompt: fullPrompt,
        model,
        size,
        background: effectiveTransparency ? "transparent" : "opaque",
        style: [...selectedEssences].join(","),
        type: dreamType,
        quality,
      });

      if (!castResult || !castResult.image) {
        throw new Error("The dream faded... no image was received.");
      }

      // 3. Show image immediately
      setDreamResult({ image: castResult.image, name: null, description: null, keywords: null });

      // 4. Divine name — get metadata from Claude
      let metadata = { name: "Unnamed Dream", description: "", keywords: [] };
      try {
        const divineResult = await divineName(castResult.image);
        if (divineResult) {
          metadata = {
            name: divineResult.name || "Unnamed Dream",
            description: divineResult.description || "",
            keywords: divineResult.keywords || [],
          };
        }
      } catch (divineErr) {
        console.warn("Card divination failed, using defaults:", divineErr);
      }

      // 5. Update result with metadata
      setDreamResult({
        image: castResult.image,
        name: metadata.name,
        description: metadata.description,
        keywords: metadata.keywords,
      });

      // 6. Upload image to InstantDB $files
      const fileId = uuidv4();
      const filePath = `dreambook/cards/${fileId}.png`;
      const blob = base64ToBlob(castResult.image, "image/png");
      const file = new File([blob], `${fileId}.png`, { type: "image/png" });

      await db.storage.upload(filePath, file);

      // 7. Write creations record
      await db.transact(
        db.tx.creations[id()].update({
          imagePath: filePath,
          type: dreamType,
          prompt: prompt,
          userId: user.id,
          createdAt: Date.now(),
          model,
          style: [...selectedEssences].join(","),
          cardName: metadata.name,
          cardDescription: metadata.description,
          cardKeywords: metadata.keywords,
          aspectRatio,
        })
      );

      // 8. Cooldown
      setCooldown(true);
      setTimeout(() => setCooldown(false), 10000);
    } catch (err) {
      console.error("Dream casting failed:", err);
      setError(err.message || "The dream faded... something went wrong.");
    } finally {
      setIsDreaming(false);
    }
  }, [prompt, isDreaming, user, buildFullPrompt, model, aspectRatio, effectiveTransparency, selectedEssences, dreamType, quality]);

  // Collect dreamed card to hand
  const handleCollect = useCallback(() => {
    if (!dreamResult || !onCollectCard) return;
    onCollectCard({
      public_id: uuidv4(),
      source: "dreamscape",
      imageUrl: `data:image/png;base64,${dreamResult.image}`,
      cardName: dreamResult.name,
      cardDescription: dreamResult.description,
    });
  }, [dreamResult, onCollectCard]);

  // Re-dream: populate settings from a journal entry
  const handleReDream = useCallback((creation) => {
    setPrompt(creation.prompt || "");
    setDreamType(creation.type || "background");
    setModel(creation.model || "flux-1.1-pro");
    setAspectRatio(creation.aspectRatio || "1:1");
    if (creation.style) {
      setSelectedEssences(new Set(creation.style.split(",").filter(Boolean)));
    } else {
      setSelectedEssences(new Set());
    }
    setActivePage("vision");
    setDreamResult(null);
    setError(null);
  }, []);

  // ─── Auth Gate ───
  if (!user) {
    return (
      <div className="dreambook dreambook--auth-gate">
        <div className="dreambook__auth-veil">
          <div className="dreambook__auth-mandala" />
          <h2 className="dreambook__auth-title">The Dreambook Awaits</h2>
          <p className="dreambook__auth-text">
            Sign in to enter the Dreambook and begin dreaming cards into existence.
          </p>
          <button
            className="dreambook__back-btn"
            onClick={onSwitchToTable}
          >
            Return to Table
          </button>
        </div>
      </div>
    );
  }

  // ─── Render Pages ───

  const renderVisionPage = () => (
    <div className="dreambook__page dreambook__page--vision">
      <h3 className="dreambook__page-title">Dream Vision</h3>

      {/* Dream type selector */}
      <div className="dreambook__type-selector">
        {DREAM_TYPES.map((type) => (
          <button
            key={type.key}
            className={`dreambook__type-btn${dreamType === type.key ? " dreambook__type-btn--active" : ""}`}
            onClick={() => {
              setDreamType(type.key);
              if (type.key === "element") {
                setTransparency(true);
              }
            }}
          >
            <span className="dreambook__type-icon">{type.icon}</span>
            <span className="dreambook__type-label">{type.label}</span>
          </button>
        ))}
      </div>

      {/* Custom prefix field */}
      {dreamType === "custom" && (
        <div className="dreambook__custom-prefix">
          <label className="dreambook__label">Custom Prefix</label>
          <input
            className="dreambook__input"
            type="text"
            placeholder="Your custom prompt prefix..."
            value={customPrefix}
            onChange={(e) => setCustomPrefix(e.target.value)}
          />
        </div>
      )}

      {/* Prompt textarea */}
      <div className="dreambook__vision-field">
        <textarea
          className="dreambook__textarea"
          placeholder="Describe your dream..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          maxLength={2000}
        />
        <div className="dreambook__char-count">
          <span className="dreambook__char-current">{prompt.length}</span>
          <span className="dreambook__char-sep">/</span>
          <span className="dreambook__char-max">2000</span>
        </div>
      </div>
    </div>
  );

  const renderDepthsPage = () => (
    <div className="dreambook__page dreambook__page--depths">
      <h3 className="dreambook__page-title">Dream Depths</h3>

      {/* Model toggle */}
      <div className="dreambook__setting">
        <label className="dreambook__label">Model</label>
        <div className="dreambook__toggle-group">
          <button
            className={`dreambook__toggle-btn${model === "flux-1.1-pro" ? " dreambook__toggle-btn--active" : ""}`}
            onClick={() => setModel("flux-1.1-pro")}
          >
            Flux 1.1 Pro
          </button>
          <button
            className={`dreambook__toggle-btn${model === "gpt-image-1.5" ? " dreambook__toggle-btn--active" : ""}`}
            onClick={() => setModel("gpt-image-1.5")}
          >
            GPT Image 1.5
          </button>
        </div>
      </div>

      {/* Aspect ratio */}
      <div className="dreambook__setting">
        <label className="dreambook__label">Aspect Ratio</label>
        <div className="dreambook__toggle-group">
          {ASPECT_RATIOS.map((ar) => (
            <button
              key={ar.key}
              className={`dreambook__toggle-btn${aspectRatio === ar.key ? " dreambook__toggle-btn--active" : ""}`}
              onClick={() => setAspectRatio(ar.key)}
            >
              <span className="dreambook__ar-icon">{ar.icon}</span>
              {ar.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quality toggle */}
      <div className="dreambook__setting">
        <label className="dreambook__label">Quality</label>
        <div className="dreambook__toggle-group">
          <button
            className={`dreambook__toggle-btn${quality === "standard" ? " dreambook__toggle-btn--active" : ""}`}
            onClick={() => setQuality("standard")}
          >
            Standard
          </button>
          <button
            className={`dreambook__toggle-btn${quality === "hd" ? " dreambook__toggle-btn--active" : ""}`}
            onClick={() => setQuality("hd")}
          >
            HD
          </button>
        </div>
      </div>

      {/* Transparency toggle */}
      <div className="dreambook__setting">
        <label className="dreambook__label">Transparency</label>
        <button
          className={`dreambook__toggle-pill${effectiveTransparency ? " dreambook__toggle-pill--active" : ""}`}
          onClick={() => setTransparency(!transparency)}
          disabled={dreamType === "element"}
        >
          <span className="dreambook__toggle-pill-knob" />
          <span className="dreambook__toggle-pill-label">
            {effectiveTransparency ? "On" : "Off"}
          </span>
        </button>
        {dreamType === "element" && (
          <span className="dreambook__setting-hint">Auto-enabled for elements</span>
        )}
      </div>
    </div>
  );

  const renderEssencesPage = () => (
    <div className="dreambook__page dreambook__page--essences">
      <h3 className="dreambook__page-title">Dream Essences</h3>
      <p className="dreambook__page-desc">
        Select one or more essences to infuse into your dream.
      </p>
      <div className="dreambook__essences-grid">
        {ESSENCES.map((essence) => (
          <button
            key={essence.key}
            className={`dreambook__essence${selectedEssences.has(essence.key) ? " dreambook__essence--active" : ""}`}
            onClick={() => toggleEssence(essence.key)}
          >
            <span className="dreambook__essence-icon">{essence.icon}</span>
            <span className="dreambook__essence-label">{essence.label}</span>
          </button>
        ))}
      </div>
      {selectedEssences.size > 0 && (
        <div className="dreambook__essences-active">
          Active: {[...selectedEssences].map((k) => {
            const e = ESSENCES.find((es) => es.key === k);
            return e ? e.label : k;
          }).join(", ")}
        </div>
      )}
    </div>
  );

  const renderJournalPage = () => (
    <div className="dreambook__page dreambook__page--journal">
      <h3 className="dreambook__page-title">Dream Journal</h3>

      {/* Filters */}
      <div className="dreambook__journal-filters">
        {["all", "flux-1.1-pro", "gpt-image-1.5", "background", "element", "freeform"].map((f) => (
          <button
            key={f}
            className={`dreambook__filter-btn${journalFilter === f ? " dreambook__filter-btn--active" : ""}`}
            onClick={() => setJournalFilter(f)}
          >
            {f === "all" ? "All" : f === "flux-1.1-pro" ? "Flux" : f === "gpt-image-1.5" ? "GPT" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Creations grid */}
      {filteredCreations.length === 0 ? (
        <div className="dreambook__journal-empty">
          {creations.length === 0
            ? "No dreams yet. Cast your first dream vision!"
            : "No dreams match this filter."}
        </div>
      ) : (
        <div className="dreambook__journal-grid">
          {filteredCreations.map((creation) => {
            const imageUrl = creation.imagePath && fileUrlMap[creation.imagePath];
            return (
              <div key={creation.id} className="dreambook__journal-card">
                <div
                  className="dreambook__journal-thumb"
                  onClick={() => imageUrl && setJournalLightbox(creation)}
                >
                  {imageUrl ? (
                    <img src={imageUrl} alt={creation.cardName || "Dream"} />
                  ) : (
                    <div className="dreambook__journal-thumb-placeholder">...</div>
                  )}
                </div>
                <div className="dreambook__journal-info">
                  <span className="dreambook__journal-name">
                    {creation.cardName || "Unnamed"}
                  </span>
                  <span className="dreambook__journal-meta">
                    {creation.model === "flux-1.1-pro" ? "Flux" : "GPT"}
                    {creation.type && <> &middot; {creation.type}</>}
                  </span>
                  <span className="dreambook__journal-date">
                    {new Date(creation.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  className="dreambook__journal-redream"
                  onClick={() => handleReDream(creation)}
                  title="Re-dream with these settings"
                >
                  &#x21BB;
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Journal lightbox */}
      {journalLightbox && (
        <div className="dreambook__lightbox" onClick={() => setJournalLightbox(null)}>
          <div className="dreambook__lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="dreambook__lightbox-close"
              onClick={() => setJournalLightbox(null)}
            >
              {"\u2715"}
            </button>
            {fileUrlMap[journalLightbox.imagePath] && (
              <img
                src={fileUrlMap[journalLightbox.imagePath]}
                alt={journalLightbox.cardName || "Dream"}
                className="dreambook__lightbox-img"
              />
            )}
            <div className="dreambook__lightbox-meta">
              <h3 className="dreambook__lightbox-name">
                {journalLightbox.cardName || "Unnamed Dream"}
              </h3>
              {journalLightbox.cardDescription && (
                <p className="dreambook__lightbox-desc">{journalLightbox.cardDescription}</p>
              )}
              {journalLightbox.cardKeywords && journalLightbox.cardKeywords.length > 0 && (
                <div className="dreambook__lightbox-keywords">
                  {journalLightbox.cardKeywords.map((kw, i) => (
                    <span key={i} className="dreambook__lightbox-keyword">{kw}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="dreambook">
      {/* Dreaming veil overlay */}
      {isDreaming && (
        <div className="dreambook__veil">
          <div className="dreambook__veil-stars" />
          <div className="dreambook__veil-mandala" />
          <div className="dreambook__veil-text">Dreaming...</div>
        </div>
      )}

      {/* Header */}
      <div className="dreambook__header">
        <button className="dreambook__back-btn" onClick={onSwitchToTable}>
          {"\u2190"} Table
        </button>
        <h2 className="dreambook__title">The Dreambook</h2>
      </div>

      {/* Tab navigation */}
      <div className="dreambook__tabs">
        {PAGES.map((page) => (
          <button
            key={page.key}
            className={`dreambook__tab${activePage === page.key ? " dreambook__tab--active" : ""}`}
            onClick={() => setActivePage(page.key)}
          >
            <span className="dreambook__tab-icon">{page.icon}</span>
            <span className="dreambook__tab-label">{page.label}</span>
          </button>
        ))}
      </div>

      {/* Page content */}
      <div className="dreambook__content">
        {activePage === "vision" && renderVisionPage()}
        {activePage === "depths" && renderDepthsPage()}
        {activePage === "essences" && renderEssencesPage()}
        {activePage === "journal" && renderJournalPage()}
      </div>

      {/* Dream result display */}
      {dreamResult && (
        <div className="dreambook__result">
          <div className="dreambook__result-card">
            <img
              src={`data:image/png;base64,${dreamResult.image}`}
              alt={dreamResult.name || "Dream card"}
              className="dreambook__result-img"
            />
            {dreamResult.name && (
              <div className="dreambook__result-name">{dreamResult.name}</div>
            )}
            {dreamResult.description && (
              <div className="dreambook__result-desc">{dreamResult.description}</div>
            )}
            {dreamResult.keywords && dreamResult.keywords.length > 0 && (
              <div className="dreambook__result-keywords">
                {dreamResult.keywords.map((kw, i) => (
                  <span key={i} className="dreambook__result-keyword">{kw}</span>
                ))}
              </div>
            )}
          </div>
          <div className="dreambook__result-actions">
            {onCollectCard && (
              <button className="dreambook__result-btn" onClick={handleCollect}>
                {"\u2726"} Collect
              </button>
            )}
            <button
              className="dreambook__result-btn dreambook__result-btn--again"
              onClick={() => setDreamResult(null)}
            >
              Dream Again
            </button>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="dreambook__error">
          <span className="dreambook__error-text">{error}</span>
          <button
            className="dreambook__error-dismiss"
            onClick={() => setError(null)}
          >
            {"\u2715"}
          </button>
        </div>
      )}

      {/* Dream button — always visible */}
      <div className="dreambook__dream-bar">
        <button
          className={`dreambook__dream-btn${isDreaming ? " dreambook__dream-btn--dreaming" : ""}`}
          onClick={handleDream}
          disabled={isDreaming || !prompt.trim() || cooldown}
        >
          {isDreaming ? (
            <>
              <span className="dreambook__dream-spinner" />
              Dreaming...
            </>
          ) : cooldown ? (
            "Rest your mind..."
          ) : (
            <>
              <span className="dreambook__dream-moon">{"\u263D"}</span>
              Dream
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ───

function base64ToBlob(base64, mime) {
  const byteChars = atob(base64);
  const byteArrays = [];
  for (let offset = 0; offset < byteChars.length; offset += 512) {
    const slice = byteChars.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: mime });
}

export default CardCreator;
