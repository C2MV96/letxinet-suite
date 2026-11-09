import os
import sys
import numpy as np
from flask import Flask, request, jsonify

app = Flask(__name__)
nlp = None

def load_model():
    global nlp
    if nlp is not None:
        return
    cache_root = os.environ.get('SPACY_CACHE_ROOT', '/app/spacy-cache')
    sm = os.path.join(cache_root, 'es_core_news_sm')
    md = os.path.join(cache_root, 'es_core_news_md')
    lg = os.path.join(cache_root, 'es_core_news_lg')
    import spacy
    # Portable-local path: try spacy.load('<name>') directly first (works when
    # the model is a pip-installed package, e.g. python-runtime embedded).
    for model_name in ('es_core_news_lg', 'es_core_news_md', 'es_core_news_sm'):
        try:
            nlp = spacy.load(model_name)
            print(f"Cargado modelo pip-installed: {model_name}", flush=True)
            return
        except Exception:
            continue
    try:
        # Patch D: prefer large model (500k vectors) → much better synonyms
        if os.path.exists(os.path.join(lg, 'config.cfg')):
            print("Cargando modelo lg (Patch D)...", flush=True)
            nlp = spacy.load(lg)
        elif os.path.exists(os.path.join(md, 'config.cfg')):
            print("Cargando modelo md (fallback)...", flush=True)
            nlp = spacy.load(md)
        elif os.path.exists(os.path.join(sm, 'config.cfg')):
            print("Cargando modelo sm (fallback)...", flush=True)
            nlp = spacy.load(sm)
        else:
            # Docker installs this model while building the Space. Do not wait
            # for a runtime model download on every restart.
            nlp = spacy.load('es_core_news_md')
            return
    except Exception as e:
        print(f"Error al cargar spaCy: {e}", flush=True)
        sys.exit(1)
    print(f"spaCy cargado exitosamente en RAM. vectors={nlp.vocab.vectors.shape if hasattr(nlp.vocab,'vectors') else 'N/A'}", flush=True)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "ready": nlp is not None})

@app.route('/analyze', methods=['POST'])
def analyze():
    if not nlp:
        return jsonify({"err": "no_model"}), 500
    data = request.json
    text = data.get('text', '')
    doc = nlp(text)
    out = {
        'lang': doc.lang_,
        'tokens': [t.text.lower() for t in doc if not t.is_space],
        'lemmas': [t.lemma_.lower() for t in doc if not t.is_punct and not t.is_space],
        'entities': [{'text': e.text, 'label': e.label_, 'start': e.start_char, 'end': e.end_char} for e in doc.ents],
        'detected_country': None,
        'noun_chunks': [c.text.lower() for c in doc.noun_chunks],
        'noun_chunks_lemmatized': [' '.join(t.lemma_.lower() for t in c if not t.is_stop and not t.is_punct).strip() for c in doc.noun_chunks],
        'stopwords': [t.text.lower() for t in doc if t.is_stop],
        'content_words': [{'text': t.text.lower(), 'lemma': t.lemma_.lower(), 'pos': t.pos_, 'tag': t.tag_} for t in doc if not t.is_punct and not t.is_space and not t.is_stop],
    }
    return jsonify(out)

@app.route('/similarity', methods=['POST'])
def similarity():
    if not nlp:
        return jsonify({"score": 0.0}), 500
    data = request.json
    word1 = data.get('word1', '')
    word2 = data.get('word2', '')
    
    # spaCy 3.x: 'in nlp.vocab' doesn't work, use direct access with try/except
    try:
        v1 = nlp.vocab[word1].vector
        v2 = nlp.vocab[word2].vector
    except KeyError:
        return jsonify({'score': 0.0})
    
    if not v1.any() or not v2.any():
        return jsonify({'score': 0.0})
        
    n1, n2 = np.linalg.norm(v1), np.linalg.norm(v2)
    if n1 == 0 or n2 == 0:
        return jsonify({'score': 0.0})
        
    sc = float(np.dot(v1, v2) / (n1 * n2))
    return jsonify({'score': max(0.0, min(1.0, sc))})

@app.route('/batch_similarity', methods=['POST'])
def batch_similarity():
    if not nlp:
        return jsonify({"scores": []}), 500
    data = request.json
    query_lemmas = data.get('query_lemmas', [])
    candidate_lemmas = data.get('candidate_lemmas', [])
    
    if not query_lemmas or not candidate_lemmas:
        return jsonify({'scores': [0.0] * len(candidate_lemmas)})
        
    q = query_lemmas[:5]
    q_vecs = [nlp.vocab[w].vector for w in q if w in nlp.vocab and nlp.vocab[w].has_vector]
    if not q_vecs:
        return jsonify({'scores': [0.0] * len(candidate_lemmas)})
        
    q_avg = np.mean(q_vecs, axis=0)
    qn = np.linalg.norm(q_avg)
    if qn == 0:
        return jsonify({'scores': [0.0] * len(candidate_lemmas)})
        
    scores = []
    for c in candidate_lemmas:
        words = c.split()
        cvecs = [nlp.vocab[w].vector for w in words if w in nlp.vocab and nlp.vocab[w].has_vector]
        if not cvecs:
            scores.append(0.0)
            continue
        cavg = np.mean(cvecs, axis=0)
        cn = np.linalg.norm(cavg)
        if cn == 0:
            scores.append(0.0)
        else:
            s = float(np.dot(q_avg, cavg) / (qn * cn))
            scores.append(max(0.0, min(1.0, s)))
            
    return jsonify({'scores': scores})

@app.route('/batch_word_similarity', methods=['POST'])
def batch_word_similarity():
    """Compare one word against multiple candidates. Returns scores for each."""
    if not nlp:
        return jsonify({"scores": []}), 500
    data = request.json
    word = data.get('word', '')
    candidates = data.get('candidates', [])

    if not word or not candidates:
        return jsonify({'scores': [0.0] * len(candidates)})

    try:
        w_vec = nlp.vocab[word].vector
    except KeyError:
        return jsonify({'scores': [0.0] * len(candidates)})

    w_norm = np.linalg.norm(w_vec)
    if w_norm == 0 or not w_vec.any():
        return jsonify({'scores': [0.0] * len(candidates)})

    scores = []
    for c in candidates:
        try:
            c_vec = nlp.vocab[c].vector
            c_norm = np.linalg.norm(c_vec)
            if c_norm == 0 or not c_vec.any():
                scores.append(0.0)
            else:
                s = float(np.dot(w_vec, c_vec) / (w_norm * c_norm))
                scores.append(max(0.0, min(1.0, s)))
        except KeyError:
            scores.append(0.0)

    return jsonify({'scores': scores})


@app.route('/concept_match', methods=['POST'])
def concept_match():
    if not nlp:
        return jsonify({"match": False}), 500
    data = request.json
    concept = data.get('concept', '')
    haystack = data.get('haystack', '')
    
    if not concept or not haystack:
        return jsonify({"match": False})
        
    c_words = [w for w in concept.split() if len(w) > 3]
    h_words = [w for w in haystack.split() if len(w) > 3]
    
    if not c_words or not h_words:
        return jsonify({"match": False})
    
    # Strategy: average vector for concept phrase, compare against each haystack word
    # This captures phrase-level semantics better than word-by-word matching
    c_vecs = []
    for cw in c_words:
        try:
            v = nlp.vocab[cw].vector
            if np.linalg.norm(v) > 0:
                c_vecs.append(v)
        except KeyError:
            pass
    
    if not c_vecs:
        return jsonify({"match": False})
    
    c_avg = np.mean(c_vecs, axis=0)
    c_norm = np.linalg.norm(c_avg)
    if c_norm == 0:
        return jsonify({"match": False})
    
    # Check if concept phrase is semantically close to ANY haystack word
    for hw in h_words:
        try:
            hw_vec = nlp.vocab[hw].vector
            hw_norm = np.linalg.norm(hw_vec)
            if hw_norm > 0:
                sim = float(np.dot(c_avg, hw_vec) / (c_norm * hw_norm))
                if sim > 0.40:
                    return jsonify({"match": True})
        except KeyError:
            pass
    
    # Fallback: word-by-word with lower threshold (0.40)
    for cw in c_words:
        found = False
        try:
            cw_vec = nlp.vocab[cw].vector
            cw_norm = np.linalg.norm(cw_vec)
            if cw_norm > 0:
                for hw in h_words:
                    if cw == hw:
                        found = True
                        break
                    try:
                        hw_vec = nlp.vocab[hw].vector
                        hw_norm = np.linalg.norm(hw_vec)
                        if hw_norm > 0:
                            sim = float(np.dot(cw_vec, hw_vec) / (cw_norm * hw_norm))
                            if sim > 0.40:
                                found = True
                                break
                    except KeyError:
                        pass
        except KeyError:
            for hw in h_words:
                if cw == hw:
                    found = True
                    break
        if not found:
            return jsonify({"match": False})
            
    return jsonify({"match": True})


@app.route('/most_similar', methods=['POST'])
def most_similar():
    """Find top-N most similar words to a query word using spaCy word vectors.
    Dynamic replacement for the hardcoded CANDIDATE_POOL in mcp.ts:626-672.
    Returns up to `topn` synonyms with cosine similarity above `threshold`.
    If word is OOV or has zero vector, returns empty list.

    Patch C (2026-07-27): Fonetic/semantic filters to reject corrupt neighbors:
      - LCS ratio >= 0.2 (filter 'ambio'/'tratamient' truncations)
      - ASCII-fold compare (filter 'educacén' encoding artifacts)
      - Anti-prefix filter (reject 'antisolar' of 'solar', 'pseudomedicina' of 'nanomedicina')
      - Substring containment (reject 'educacion'/'educacén' near-duplicates)
      - Length-diff filter (reject 'ambio' len=5 missing first chars of 'cambio' len=6)
    """
    if not nlp:
        return jsonify({"synonyms": []}), 500
    data = request.json or {}
    word = data.get('word', '')
    topn = int(data.get('topn', 10))
    threshold = float(data.get('threshold', 0.7))  # default 0.7 to filter noise
    if not word:
        return jsonify({"synonyms": []})
    try:
        q = nlp.vocab[word]
        if not q.has_vector or not q.vector.any():
            return jsonify({"synonyms": []})
    except KeyError:
        return jsonify({"synonyms": []})
    q_vec = q.vector
    q_norm = np.linalg.norm(q_vec)
    if q_norm == 0:
        return jsonify({"synonyms": []})

    # Patch C: precompute ASCII-folded query word for comparisons
    import unicodedata
    word_lower = word.lower()
    word_ascii = ''.join(c for c in unicodedata.normalize('NFKD', word_lower)
                         if not unicodedata.combining(c))
    word_len = len(word_ascii)

    # Patch C: anti-prefixes that signal antonym (reject if candidate has them but query doesn't)
    ANTI_PREFIXES = ('anti', 'pseudo', 'contra', 'anti', 'no', 'post', 'pre')

    # Patch C: LCS ratio helper (Levenshtein-like similarity)
    def lcs_ratio(a, b):
        """Longest Common Subsequence length / max(len). ~5ms per call."""
        if a == b:
            return 1.0
        m, n = len(a), len(b)
        if m == 0 or n == 0:
            return 0.0
        # Iterative DP (avoid recursion limits)
        prev = [0] * (n + 1)
        for i in range(1, m + 1):
            curr = [0] * (n + 1)
            for j in range(1, n + 1):
                if a[i - 1] == b[j - 1]:
                    curr[j] = prev[j - 1] + 1
                else:
                    curr[j] = max(prev[j], curr[j - 1])
            prev = curr
        return prev[n] / max(m, n)

    # Use built-in fast most_similar (matrix dot-product, ~120ms for 20k vectors)
    try:
        q_2d = q_vec.reshape(1, -1)
        # Ask for 50 candidates, filter noise later
        fetch_n = max(topn * 5, 50)
        result = nlp.vocab.vectors.most_similar(q_2d, n=fetch_n)
        keys = result[0][0]
        sims = result[2][0]
        out = []
        for i in range(keys.shape[0]):
            k = int(keys[i])
            try:
                text = nlp.vocab.strings[k]
            except KeyError:
                continue
            if not text or text == word:
                continue
            # Filter: skip non-alphabetic, skip 3-char words, skip uppercase-heavy (likely named entities)
            if not text.isalpha():
                continue
            if len(text) < 4:
                continue
            # Skip words starting with uppercase (proper nouns like Citrobacter, Citrobacter)
            if text[0].isupper():
                continue

            # === Patch C: fonetic/semantic filters ===
            text_lower = text.lower()
            text_ascii = ''.join(c for c in unicodedata.normalize('NFKD', text_lower)
                                 if not unicodedata.combining(c))
            text_len = len(text_ascii)

            # C1: Length-diff filter — reject truncations ('ambio' = 4 vs 'cambio' = 6)
            # Patch C1b (2026-07-30): aflojar — solo reject diff>4 (very small candidate)
            # manteniendo prefix overlap rule. diff 3-4 generalmente sinonimo (narco vs sicariato)
            if text_len < word_len and word_ascii[:2].lower() not in text_ascii[:3] and abs(text_len - word_len) > 4:
                continue

            # C2: Anti-prefix filter — antonym detection
            # If candidate starts with 'anti', 'pseudo', 'contra' but query doesn't → antonym → SKIP
            skip_c2 = False
            for ap in ANTI_PREFIXES:
                if text_ascii.startswith(ap) and not word_ascii.startswith(ap):
                    skip_c2 = True
                    break
            if skip_c2:
                continue

            # C3: Substring containment — reject near-duplicates ('educacén' of 'educacion')
            # Patch C3 (2026-07-30): aflojar diff<=1 — solo reject typos/encoding
            # (1 char diff). diff>=2 es derivación morfológica válida
            # (sicario/sicariato diff=2, punible/punibles diff=1 reject OK as flexion)
            if text_ascii != word_ascii:
                if text_ascii in word_ascii or word_ascii in text_ascii:
                    if abs(text_len - word_len) <= 1:
                        continue

            # C4: LCS ratio filter — reject semantically unrelated ('termodinamica' of 'arsenico', 'redshift' of 'kinetic')
            # Patch C4b3 (2026-07-30): keep lcs computed (C4b/C4c depend on it) but
            # disable the LCS threshold filter (too aggressive for cross-domain synonyms
            # like peru/mexico lcs=0.17).
            lcs = lcs_ratio(word_ascii, text_ascii)
            # Patch C4b4: initialize common_prefix/suffix defaults so C4c works
            # even when C4b scope (word_len and text_len >= 5) is skipped.
            common_prefix = 0
            common_suffix = 0
            # (filter disabled — keep comment for documentation)
            # if lcs < 0.2 and word_len >= 5 and text_len >= 5:
            #     continue

            # C4b: Suffix-overlap without prefix overlap — reject false friends by stem
            # 'enhancer' & 'cancer': common suffix 'ancer'=5, prefix=0
            # 'fibroadenomy' & 'cancer': common suffix 'omy...er'=?, prefix=0 → use min overlap check
            if word_len >= 5 and text_len >= 5:
                common_suffix = 0
                for x, y in zip(reversed(word_ascii), reversed(text_ascii)):
                    if x == y: common_suffix += 1
                    else: break
                common_prefix = 0
                for x, y in zip(word_ascii, text_ascii):
                    if x == y: common_prefix += 1
                    else: break
                # Reject if suffix overlap >= 4 AND no prefix overlap (likely false friend: cancer/enhancer)
                if common_suffix >= 4 and common_prefix == 0:
                    continue
                # Reject if prefix overlap == 0 AND length diff <= 2 AND lcs < 0.5
                # (catches: kinetic/redshift, arsenico/termodinamica if lcs slipped)
                if common_prefix == 0 and abs(text_len - word_len) <= 2 and lcs < 0.5:
                    continue

            # C4c: High prefix overlap but suffix changes meaning ('educacén' of 'educacion')
            # Patch C4 (2026-07-30): aflojar lcs cutoff 0.85 -> 0.6
            # (reject only true orthographic variants with low similarity,
            #  not morphological derivatives like sicario/sicariato lcs=0.78)
            if text_ascii != word_ascii and common_prefix >= 5 and lcs < 0.6 and min(word_len, text_len) <= 10:
                continue

            sim = float(sims[i])
            # C5: Bump effective threshold slightly for short words (more discriminant)
            effective_th = threshold * (0.95 if word_len <= 5 else 1.0)
            if sim < effective_th:
                continue
            out.append({"word": text, "score": round(sim, 3)})
            if len(out) >= topn:
                break
        seen = set()
        dedup = []
        for o in out:
            if o["word"] not in seen:
                seen.add(o["word"])
                dedup.append(o)
        return jsonify({"synonyms": dedup[:topn]})
    except Exception as e:
        print(f"[most_similar] ERR: {e}", flush=True)
        return jsonify({"synonyms": []}), 200


if __name__ == '__main__':
    print("Iniciando microservicio spaCy...", flush=True)
    load_model()
    # SPACY_PORT env var (default 4002) — respects SPACY_PORT set by spacy-client.ts
    port = int(os.environ.get('SPACY_PORT', '4002'))
    print(f"spacy_server listening on port {port}", flush=True)
    app.run(host='127.0.0.1', port=port, threaded=True)
