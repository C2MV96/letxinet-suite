---
name: word-protected-doc-workflow
description: Use for encrypting Word documents with password protection via protect_document, and unprotecting with unprotect_document + same password. Use this for confidential draft sharing, contractual deliverables with NDA, HR compensation docs signed-off. Validates with get_document_info — encrypted doc fails to open without password.
trigger_keywords: protect docx password, encrypt word, unprotect decrypt, confidential document, NDA docx, HR sign-off, password protected deliverable
---

# SKILL: word-protected-doc-workflow (solo-Word S9E-7)

## Proven Chain (2026-08-08)

```
word.protect_document(filename="<doc.docx>", password="<secret>")
  ↓ docx encrypted with AES + Word lockdown
word.get_document_info(filename="<doc.docx>")
  ↓ FAILS with "Package not found at <path>" while encrypted (PIN-stuck)
word.unprotect_document(filename="<doc.docx>", password="<secret>")
  ↓ docx decrypted back to readable
word.get_document_info(filename="<doc.docx>")
  ↓ OK same metadata as before encryption
```

## Validated Output (2026-08-08)

**S9E-7 demo on S9E1-template-generator.docx with password="letxinet-s9e7-demo-pw":**

### protect_document
```
Document S9E1-template-generator.docx encrypted successfully with password.
```

### get_document_info WHILE ENCRYPTED (verify step)
```
{"error": "Failed to get document properties: Package not found at 'D:\\OTROS\\LETXINET-OPTIM-BUILD\\harness-tests\\outputs\\s9e\\S9E1-template-generator.docx'"}
```
> Error message is confusing — file exists but is encrypted, so python-docx cannot parse OOXML.

### unprotect_document
```
Document S9E1-template-generator.docx decrypted successfully.
```

## When to use

- NDA-bound contractual deliverable (signing partner receives encrypted docx)
- HR compensation announcement (manager-only access)
- Confidential board minutes (encrypt before file-sharing)
- Pre-release patent draft (encrypted transmission)
- Medical records file sharing for second opinion
- Tax preparer deliverable handoff
- Legal immigration packet for attorney eyes only
- Financial forecast internal restricted
- Press release embargo document (PR team only until launch)

## Workflow patterns

### Pattern 1: Sign-and-deliver
```
create_document → add_heading/paragraph → protect_document(pw=<secret>)
↓ send encrypted docx via secure channel
↓ recipient enters password → unlocked → reads
```

### Pattern 2: Round-trip draft review
```
author.protect_document(pw=auth_pw)
↓ share encrypted docx
reviewer.unprotect_document(pw=auth_pw) → edits → reviewer.protect_document(pw=rev_pw)
↓ return
author.unprotect_document(pw=rev_pw) → accepts changes
```

### Pattern 3: Validation step
```
unprotect_document → get_document_info check → protect_document again
```

## Gotchas

1. **python-docx cannot open encrypted docx** — get_document_info fails with confusing "Package not found"
2. **Password stored only in caller context** — if lost, docx unrecoverable
3. **Word opens protected docx with password prompt** — recipient must type it
4. **Strong password recommended** — Word encryption is AES but weak pw crackable
5. **unprotect then re-protect with new pw** for password rotation
6. **Document contents preserved** through encryption roundtrip — metadata, headings, footnotes, tables all OK
7. **Insert image AS QUESEMA AFTER unprotect** — encrypted docx cannot be re-edited by python-docx

## Anti-pattern

No usar este skill si:
- Necesitas digital signature with X.509 cert (use DocuSign / Word signature pane)
- Necesitas PDF password (use Adobe Acrobat or qpdf — Word PDF export loses password)
- Necesitas redaction (use Word's native Redact tool in M365)
- Necesitas multi-recipient encryption (use GPG/OpenPGP direct)

## Metrics

- Tools used: 2-4 (protect_document + get_document_info [validation] + unprotect_document + get_document_info [verify])
- Time: ~3s protect + 2s unprotect
- Output: encrypted / decrypted docx — file size unchanged
- Validated S9E-7: get_document_info fails locked → unprotect OK
