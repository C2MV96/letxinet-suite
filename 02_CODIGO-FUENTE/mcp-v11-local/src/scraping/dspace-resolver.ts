/**
 * DSpace Repository PDF Extractor
 * Extracts PDF download URLs from DSpace-based institutional repositories.
 * Supports Peruvian universities and any standard DSpace installation.
 * 
 * Flow: handle URL â†’ fetch HTML â†’ parse bitstream link â†’ download PDF
 */

import { resilientFetch } from '../scraping/resilient-fetch';
import { fetchWithTimeout } from '../providers/base';
import { collectDocumentCandidateUrls, isLikelyPdfBuffer, sanitizeDocumentUrl } from '../utils/document-url';

/** Fix URLs that contain localhost/127.0.0.1 (DSpace 7 misconfigured servers) */
function sanitizeRepoUrl(extracted: string, baseUrl: string): string | null {
    try {
        const parsed = new URL(extracted, baseUrl);
        if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
            const realOrigin = new URL(baseUrl);
            parsed.protocol = realOrigin.protocol;
            parsed.hostname = realOrigin.hostname;
            parsed.port = ''; // Remove internal port (4000, etc.)
        }
        return parsed.href;
    } catch { return null; }
}

// â”€â”€â”€ Known DSpace Repositories (PerÃº) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface DSpaceRepo {
    name: string;
    domain: string;
    handlePrefix: string;   // e.g., '20.500.12404' for PUCP
    bitstreamPattern: 'standard' | 'bitstream-id' | 'scielo-pdf';
}

const PERU_DSPACE_REPOS: DSpaceRepo[] = [
    // â”€â”€ Original (13) â”€â”€
    { name: 'PUCP', domain: 'tesis.pucp.edu.pe', handlePrefix: '20.500.12404', bitstreamPattern: 'standard' },
    { name: 'UNMSM', domain: 'cybertesis.unmsm.edu.pe', handlePrefix: '20.500.12672', bitstreamPattern: 'standard' },
    { name: 'UNSA', domain: 'repositorio.unsa.edu.pe', handlePrefix: '20.500.12773', bitstreamPattern: 'standard' },
    { name: 'UNSAAC', domain: 'repositorio.unsaac.edu.pe', handlePrefix: '20.500.12918', bitstreamPattern: 'standard' },
    { name: 'USMP', domain: 'repositorio.usmp.edu.pe', handlePrefix: '20.500.12727', bitstreamPattern: 'standard' },
    { name: 'UContinental', domain: 'repositorio.continental.edu.pe', handlePrefix: '20.500.12394', bitstreamPattern: 'standard' },
    { name: 'UNAC', domain: 'repositorio.unac.edu.pe', handlePrefix: '20.500.12952', bitstreamPattern: 'standard' },
    { name: 'UNCP', domain: 'repositorio.uncp.edu.pe', handlePrefix: '20.500.12894', bitstreamPattern: 'standard' },
    { name: 'UNPRG', domain: 'repositorio.unprg.edu.pe', handlePrefix: '20.500.12893', bitstreamPattern: 'standard' },
    { name: 'USIL', domain: 'repositorio.usil.edu.pe', handlePrefix: 'usil', bitstreamPattern: 'standard' },
    { name: 'UPC', domain: 'repositorioacademico.upc.edu.pe', handlePrefix: '10757', bitstreamPattern: 'standard' },
    { name: 'ULIMA', domain: 'repositorio.ulima.edu.pe', handlePrefix: '20.500.12724', bitstreamPattern: 'standard' },
    { name: 'RENATI', domain: 'renati.sunedu.gob.pe', handlePrefix: 'sunedu', bitstreamPattern: 'standard' },
    // â”€â”€ Auto-discovered batch 1 (8 repos, Jun 2026) â”€â”€
    { name: 'UPN', domain: 'repositorio.upn.edu.pe', handlePrefix: '11537', bitstreamPattern: 'standard' },
    { name: 'UNAS', domain: 'repositorio.unas.edu.pe', handlePrefix: 'UNAS', bitstreamPattern: 'standard' },
    { name: 'UNAMBA', domain: 'repositorio.unamba.edu.pe', handlePrefix: 'UNAMBA', bitstreamPattern: 'standard' },
    { name: 'ESAN', domain: 'repositorio.esan.edu.pe', handlePrefix: '20.500.12640', bitstreamPattern: 'standard' },
    { name: 'UP', domain: 'repositorio.up.edu.pe', handlePrefix: '11354', bitstreamPattern: 'standard' },
    { name: 'UTEC', domain: 'repositorio.utec.edu.pe', handlePrefix: '20.500.12816', bitstreamPattern: 'standard' },
    { name: 'UARM', domain: 'repositorio.uarm.edu.pe', handlePrefix: '20.500.12833', bitstreamPattern: 'standard' },
    { name: 'UCSP', domain: 'repositorio.ucsp.edu.pe', handlePrefix: '20.500.12590', bitstreamPattern: 'standard' },
    // â”€â”€ Auto-discovered batch 2 â€” Nacionales (49 repos, Jun 2026) â”€â”€
    { name: 'UNFV', domain: 'repositorio.unfv.edu.pe', handlePrefix: 'UNFV', bitstreamPattern: 'standard' },
    { name: 'UNALM', domain: 'repositorio.lamolina.edu.pe', handlePrefix: 'UNALM', bitstreamPattern: 'standard' },
    { name: 'UNDAC', domain: 'repositorio.undac.edu.pe', handlePrefix: 'UNDAC', bitstreamPattern: 'standard' },
    { name: 'UNCajamarca', domain: 'repositorio.unc.edu.pe', handlePrefix: 'UNC', bitstreamPattern: 'standard' },
    { name: 'UNHEVAL', domain: 'repositorio.unheval.edu.pe', handlePrefix: 'UNHEVAL', bitstreamPattern: 'standard' },
    { name: 'UNJFSC', domain: 'repositorio.unjfsc.edu.pe', handlePrefix: 'UNJFSC', bitstreamPattern: 'standard' },
    { name: 'UNTRM', domain: 'repositorio.untrm.edu.pe', handlePrefix: 'UNTRM', bitstreamPattern: 'standard' },
    { name: 'UNIA', domain: 'repositorio.unia.edu.pe', handlePrefix: 'UNIA', bitstreamPattern: 'standard' },
    { name: 'UNICA', domain: 'repositorio.unica.edu.pe', handlePrefix: 'UNICA', bitstreamPattern: 'standard' },
    { name: 'UNBarranca', domain: 'repositorio.unab.edu.pe', handlePrefix: 'UNAB', bitstreamPattern: 'standard' },
    { name: 'UNCanete', domain: 'repositorio.undc.edu.pe', handlePrefix: 'UNDC', bitstreamPattern: 'standard' },
    { name: 'UNFrontera', domain: 'repositorio.unf.edu.pe', handlePrefix: 'UNF', bitstreamPattern: 'standard' },
    { name: 'UNJuliaca', domain: 'repositorio.unaj.edu.pe', handlePrefix: 'UNAJ', bitstreamPattern: 'standard' },
    { name: 'UNChota', domain: 'repositorio.unach.edu.pe', handlePrefix: 'UNACH', bitstreamPattern: 'standard' },
    { name: 'UNHuanta', domain: 'repositorio.unah.edu.pe', handlePrefix: 'UNAH', bitstreamPattern: 'standard' },
    { name: 'UNMusica', domain: 'repositorio.unm.edu.pe', handlePrefix: 'UNM', bitstreamPattern: 'standard' },
    { name: 'UNAMAD', domain: 'repositorio.unamad.edu.pe', handlePrefix: 'UNAMAD', bitstreamPattern: 'standard' },
    { name: 'UNSM', domain: 'repositorio.unsm.edu.pe', handlePrefix: 'UNSM', bitstreamPattern: 'standard' },
    { name: 'UNSanta', domain: 'repositorio.uns.edu.pe', handlePrefix: 'UNS', bitstreamPattern: 'standard' },
    { name: 'UNPiura', domain: 'repositorio.unp.edu.pe', handlePrefix: 'UNP', bitstreamPattern: 'standard' },
    // â”€â”€ Auto-discovered batch 2 â€” Privadas â”€â”€
    { name: 'UCSM', domain: 'repositorio.ucsm.edu.pe', handlePrefix: '20.500.12920', bitstreamPattern: 'standard' },
    { name: 'UCV', domain: 'repositorio.ucv.edu.pe', handlePrefix: 'UCV', bitstreamPattern: 'standard' },
    { name: 'UPAO', domain: 'repositorio.upao.edu.pe', handlePrefix: 'UPAO', bitstreamPattern: 'standard' },
    { name: 'ULADECH', domain: 'repositorio.uladech.edu.pe', handlePrefix: 'ULADECH', bitstreamPattern: 'standard' },
    { name: 'UPLA', domain: 'repositorio.upla.edu.pe', handlePrefix: 'UPLA', bitstreamPattern: 'standard' },
    { name: 'USS', domain: 'repositorio.uss.edu.pe', handlePrefix: 'USS', bitstreamPattern: 'standard' },
    { name: 'URP', domain: 'repositorio.urp.edu.pe', handlePrefix: 'URP', bitstreamPattern: 'standard' },
    { name: 'UAP', domain: 'repositorio.uap.edu.pe', handlePrefix: 'UAP', bitstreamPattern: 'standard' },
    { name: 'USAT', domain: 'repositorio.usat.edu.pe', handlePrefix: 'USAT', bitstreamPattern: 'standard' },
    { name: 'UAndina', domain: 'repositorio.uandina.edu.pe', handlePrefix: 'UAndina', bitstreamPattern: 'standard' },
    { name: 'UCSS', domain: 'repositorio.ucss.edu.pe', handlePrefix: 'UCSS', bitstreamPattern: 'standard' },
    { name: 'USanPedro', domain: 'repositorio.usanpedro.edu.pe', handlePrefix: 'USanPedro', bitstreamPattern: 'standard' },
    { name: 'UCientifica', domain: 'repositorio.cientifica.edu.pe', handlePrefix: 'UCientifica', bitstreamPattern: 'standard' },
    { name: 'UPeU', domain: 'repositorio.upeu.edu.pe', handlePrefix: 'UPeU', bitstreamPattern: 'standard' },
    { name: 'UNIFE', domain: 'repositorio.unife.edu.pe', handlePrefix: 'UNIFE', bitstreamPattern: 'standard' },
    { name: 'UIGV', domain: 'repositorio.uigv.edu.pe', handlePrefix: 'UIGV', bitstreamPattern: 'standard' },
    { name: 'NorbertWiener', domain: 'repositorio.uwiener.edu.pe', handlePrefix: 'UWiener', bitstreamPattern: 'standard' },
    { name: 'UPSJB', domain: 'repositorio.upsjb.edu.pe', handlePrefix: 'UPSJB', bitstreamPattern: 'standard' },
    { name: 'UDH', domain: 'repositorio.udh.edu.pe', handlePrefix: 'UDH', bitstreamPattern: 'standard' },
    { name: 'UTEA', domain: 'repositorio.utea.edu.pe', handlePrefix: 'UTEA', bitstreamPattern: 'standard' },
    { name: 'UAustral', domain: 'repositorio.uaustral.edu.pe', handlePrefix: 'UAustral', bitstreamPattern: 'standard' },
    { name: 'UPCH', domain: 'repositorio.upch.edu.pe', handlePrefix: '20.500.12866', bitstreamPattern: 'standard' },
    { name: 'UCH', domain: 'repositorio.uch.edu.pe', handlePrefix: 'UCH', bitstreamPattern: 'standard' },
    { name: 'LeCordonBleu', domain: 'repositorio.ulcb.edu.pe', handlePrefix: 'ULCB', bitstreamPattern: 'standard' },
    { name: 'Champagnat', domain: 'repositorio.umch.edu.pe', handlePrefix: 'UMCH', bitstreamPattern: 'standard' },
    { name: 'MariaAuxiliadora', domain: 'repositorio.uma.edu.pe', handlePrefix: 'UMA', bitstreamPattern: 'standard' },
    { name: 'UDesarrolloAndino', domain: 'repositorio.udea.edu.pe', handlePrefix: 'UDEA', bitstreamPattern: 'standard' },
    { name: 'PeruanoCentro', domain: 'repositorio.upecen.edu.pe', handlePrefix: 'UPECEN', bitstreamPattern: 'standard' },
    { name: 'LaSalle', domain: 'repositorio.ulasalle.edu.pe', handlePrefix: 'ULaSalle', bitstreamPattern: 'standard' },
    { name: 'UPrivadaTrujillo', domain: 'repositorio.uprit.edu.pe', handlePrefix: 'UPRIT', bitstreamPattern: 'standard' },
    // â”€â”€ Government / Institutes â”€â”€
    { name: 'IMARPE', domain: 'repositorio.imarpe.gob.pe', handlePrefix: 'IMARPE', bitstreamPattern: 'standard' },
    { name: 'INGEMMET', domain: 'repositorio.ingemmet.gob.pe', handlePrefix: 'INGEMMET', bitstreamPattern: 'standard' },
    { name: 'IEP', domain: 'repositorio.iep.org.pe', handlePrefix: 'IEP', bitstreamPattern: 'standard' },
    { name: 'IIAP', domain: 'repositorio.iiap.gob.pe', handlePrefix: 'IIAP', bitstreamPattern: 'standard' },
    { name: 'IPEN', domain: 'repositorio.ipen.gob.pe', handlePrefix: 'IPEN', bitstreamPattern: 'standard' },
    { name: 'INDECOPI', domain: 'repositorio.indecopi.gob.pe', handlePrefix: 'INDECOPI', bitstreamPattern: 'standard' },
    { name: 'MINEDU', domain: 'repositorio.minedu.gob.pe', handlePrefix: 'MINEDU', bitstreamPattern: 'standard' },
    { name: 'MINCULTURA', domain: 'repositorio.cultura.gob.pe', handlePrefix: 'CULTURA', bitstreamPattern: 'standard' },
    { name: 'Toulouse', domain: 'repositorio.tls.edu.pe', handlePrefix: 'TLS', bitstreamPattern: 'standard' },
    // -- Missing from OAI sync (added Jun. 2026) --
    { name: 'INIA', domain: 'repositorio.inia.gob.pe', handlePrefix: '20.500.12955', bitstreamPattern: 'standard' },
    { name: 'UANCV', domain: 'repositorio.uancv.edu.pe', handlePrefix: 'UANCV', bitstreamPattern: 'standard' },
    { name: 'UNASAM', domain: 'repositorio.unasam.edu.pe', handlePrefix: 'UNASAM', bitstreamPattern: 'standard' },
    { name: 'UNAJMA', domain: 'repositorio.unajma.edu.pe', handlePrefix: 'UNAJMA', bitstreamPattern: 'standard' },
    { name: 'UNPRG', domain: 'repositorio.unprg.edu.pe', handlePrefix: '20.500.12893', bitstreamPattern: 'standard' },
    // -- ARGENTINA (auto-discovered Jun. 2026) --
    { name: 'UBA-SISBI', domain: 'repositoriouba.sisbi.uba.ar', handlePrefix: 'UBA-SISBI', bitstreamPattern: 'standard' },
    { name: 'CLACSO', domain: 'biblioteca-repositorio.clacso.edu.ar', handlePrefix: 'CLACSO', bitstreamPattern: 'standard' },
    { name: 'SciELO-Argentina', domain: 'www.scielo.org.ar', handlePrefix: 'SCIELO-ARGENTINA', bitstreamPattern: 'standard' },
    { name: 'UNC-Cordoba', domain: 'rdu.unc.edu.ar', handlePrefix: 'UNC-CORDOBA', bitstreamPattern: 'standard' },
    { name: 'UNLP-LaPlata', domain: 'sedici.unlp.edu.ar', handlePrefix: 'UNLP-LAPLATA', bitstreamPattern: 'standard' },
    { name: 'UNL-SantaFe', domain: 'bibliotecavirtual.unl.edu.ar', handlePrefix: 'UNL-SANTAFE', bitstreamPattern: 'standard' },
    { name: 'UNCuyo', domain: 'bdigital.uncu.edu.ar', handlePrefix: 'UNCUYO', bitstreamPattern: 'standard' },
    { name: 'UTN', domain: 'ria.utn.edu.ar', handlePrefix: 'UTN', bitstreamPattern: 'standard' },
    { name: 'UNS-BahiaBlanca', domain: 'repositoriodigital.uns.edu.ar', handlePrefix: 'UNS-BAHIABLANCA', bitstreamPattern: 'standard' },
    { name: 'INTA', domain: 'repositorio.inta.gob.ar', handlePrefix: 'INTA', bitstreamPattern: 'standard' },
    // -- CHILE (auto-discovered Jun. 2026) --
    { name: 'UChile', domain: 'repositorio.uchile.cl', handlePrefix: 'UCHILE', bitstreamPattern: 'standard' },
    { name: 'USACH', domain: 'repositorio.usach.cl', handlePrefix: 'USACH', bitstreamPattern: 'standard' },
    { name: 'UdeC', domain: 'repositorio.udec.cl', handlePrefix: 'UDEC', bitstreamPattern: 'standard' },
    { name: 'UAI', domain: 'repositorio.uai.cl', handlePrefix: 'UAI', bitstreamPattern: 'standard' },
    { name: 'UDP', domain: 'repositorio.udp.cl', handlePrefix: 'UDP', bitstreamPattern: 'standard' },
    { name: 'UCN', domain: 'repositorio.ucn.cl', handlePrefix: 'UCN', bitstreamPattern: 'standard' },
    { name: 'UBB', domain: 'repositorio.ubiobio.cl', handlePrefix: 'UBB', bitstreamPattern: 'standard' },
    { name: 'UTEM', domain: 'repositorio.utem.cl', handlePrefix: 'UTEM', bitstreamPattern: 'standard' },
    // -- COLOMBIA (auto-discovered Jun. 2026) --
    { name: 'UNAL', domain: 'repositorio.unal.edu.co', handlePrefix: 'UNAL', bitstreamPattern: 'standard' },
    { name: 'UniAndes', domain: 'repositorio.uniandes.edu.co', handlePrefix: 'UNIANDES', bitstreamPattern: 'standard' },
    { name: 'UdeA', domain: 'bibliotecadigital.udea.edu.co', handlePrefix: 'UDEA', bitstreamPattern: 'standard' },
    { name: 'UIS', domain: 'noesis.uis.edu.co', handlePrefix: 'UIS', bitstreamPattern: 'standard' },
    { name: 'UniValle', domain: 'bibliotecadigital.univalle.edu.co', handlePrefix: 'UNIVALLE', bitstreamPattern: 'standard' },
    { name: 'UPB', domain: 'repository.upb.edu.co', handlePrefix: 'UPB', bitstreamPattern: 'standard' },
    { name: 'EAFIT', domain: 'repository.eafit.edu.co', handlePrefix: 'EAFIT', bitstreamPattern: 'standard' },
    { name: 'UniNorte', domain: 'manglar.uninorte.edu.co', handlePrefix: 'UNINORTE', bitstreamPattern: 'standard' },
    { name: 'UTP', domain: 'repositorio.utp.edu.co', handlePrefix: 'UTP', bitstreamPattern: 'standard' },
    { name: 'UniCartagena', domain: 'repositorio.unicartagena.edu.co', handlePrefix: 'UNICARTAGENA', bitstreamPattern: 'standard' },
    { name: 'USabana', domain: 'intellectum.unisabana.edu.co', handlePrefix: 'USABANA', bitstreamPattern: 'standard' },
    { name: 'MinCiencias', domain: 'repositorio.minciencias.gov.co', handlePrefix: 'MINCIENCIAS', bitstreamPattern: 'standard' },
    // -- ECUADOR (auto-discovered Jun. 2026) --
    { name: 'RRAAE', domain: 'rraae.cedia.edu.ec', handlePrefix: 'RRAAE', bitstreamPattern: 'standard' },
    { name: 'ESPOL', domain: 'www.dspace.espol.edu.ec', handlePrefix: 'ESPOL', bitstreamPattern: 'standard' },
    { name: 'UCE', domain: 'www.dspace.uce.edu.ec', handlePrefix: 'UCE', bitstreamPattern: 'standard' },
    { name: 'UTPL', domain: 'dspace.utpl.edu.ec', handlePrefix: 'UTPL', bitstreamPattern: 'standard' },
    { name: 'USFQ', domain: 'repositorio.usfq.edu.ec', handlePrefix: 'USFQ', bitstreamPattern: 'standard' },
    { name: 'UTN', domain: 'repositorio.utn.edu.ec', handlePrefix: 'UTN', bitstreamPattern: 'standard' },
    { name: 'UCSG', domain: 'repositorio.ucsg.edu.ec', handlePrefix: 'UCSG', bitstreamPattern: 'standard' },
    { name: 'UNACH', domain: 'dspace.unach.edu.ec', handlePrefix: 'UNACH', bitstreamPattern: 'standard' },
    // -- MEXICO (auto-discovered Jun. 2026) --
    { name: 'UNAM', domain: 'repositorio.unam.mx', handlePrefix: 'UNAM', bitstreamPattern: 'standard' },
    { name: 'SciELO-Mexico', domain: 'www.scielo.org.mx', handlePrefix: 'SCIELO-MEXICO', bitstreamPattern: 'standard' },
    { name: 'Redalyc', domain: 'www.redalyc.org', handlePrefix: 'REDALYC', bitstreamPattern: 'standard' },
    { name: 'UAM', domain: 'zaloamati.azc.uam.mx', handlePrefix: 'UAM', bitstreamPattern: 'standard' },
    { name: 'COLMEX', domain: 'repositorio.colmex.mx', handlePrefix: 'COLMEX', bitstreamPattern: 'standard' },
    { name: 'UV', domain: 'cdigital.uv.mx', handlePrefix: 'UV', bitstreamPattern: 'standard' },
    { name: 'UADY', domain: 'repositorio.uady.mx', handlePrefix: 'UADY', bitstreamPattern: 'standard' },
    { name: 'UIA', domain: 'repositorio.uia.mx', handlePrefix: 'UIA', bitstreamPattern: 'standard' },
    { name: 'CIESAS', domain: 'repositorio.ciesas.edu.mx', handlePrefix: 'CIESAS', bitstreamPattern: 'standard' },
    { name: 'COLEF', domain: 'www.colef.mx', handlePrefix: 'COLEF', bitstreamPattern: 'standard' },
    // -- PERU (auto-discovered Jun. 2026) --
    { name: 'UANCV', domain: 'repositorio.uancv.edu.pe', handlePrefix: 'UANCV', bitstreamPattern: 'standard' },
    { name: 'UNSCH', domain: 'repositorio.unsch.edu.pe', handlePrefix: 'UNSCH', bitstreamPattern: 'standard' },
    { name: 'UNJBG-Tacna', domain: 'repositorio.unjbg.edu.pe', handlePrefix: 'UNJBG-TACNA', bitstreamPattern: 'standard' },
    { name: 'UNASAM', domain: 'repositorio.unasam.edu.pe', handlePrefix: 'UNASAM', bitstreamPattern: 'standard' },
    // -- SciELO Peru (added Fase 1.2) --
    { name: 'SciELO-Peru', domain: 'www.scielo.org.pe', handlePrefix: 'SCIELO-PERU', bitstreamPattern: 'scielo-pdf' },
    { name: 'SciELO-Peru-Alt', domain: 'scielo.org.pe', handlePrefix: 'SCIELO-PERU', bitstreamPattern: 'scielo-pdf' },
    // -- Auto-discovered (Jun. 2026) --
    { name: 'INIA', domain: 'repositorio.inia.gob.pe', handlePrefix: 'INIA', bitstreamPattern: 'standard' },
    // -- Fase 3.3 (Jun 2026): Recovered/updated repos --
    { name: 'UNT-Trujillo', domain: 'repositorio.unitru.edu.pe', handlePrefix: '20.500.26426', bitstreamPattern: 'standard' },
    // -- Auto-discovered (Jun. 2026) --
    { name: 'UFranklinRoosevelt', domain: 'repositorio.uroosevelt.edu.pe', handlePrefix: 'UFRANKLINROOSEVELT', bitstreamPattern: 'standard' },
    { name: 'CONCYTEC-ALICIA', domain: 'alicia.concytec.gob.pe', handlePrefix: 'CONCYTEC-ALICIA', bitstreamPattern: 'standard' },
    // -- Auto-discovered (Jun. 2026) --
    { name: 'UNJaen', domain: 'repositorio.unj.edu.pe', handlePrefix: 'UNJAEN', bitstreamPattern: 'standard' },
    // -- ARGENTINA (auto-discovered Jul. 2026) --
    { name: 'UNGS', domain: 'repositorio.ungs.edu.ar', handlePrefix: 'UNGS', bitstreamPattern: 'standard' },
    // -- BRASIL (auto-discovered Jul. 2026) --
    { name: 'SciELO-Brasil', domain: 'www.scielo.br', handlePrefix: 'SCIELO-BRASIL', bitstreamPattern: 'standard' },
    { name: 'USP-Teses', domain: 'teses.usp.br', handlePrefix: 'USP-TESES', bitstreamPattern: 'standard' },
    { name: 'UNICAMP', domain: 'repositorio.unicamp.br', handlePrefix: 'UNICAMP', bitstreamPattern: 'standard' },
    { name: 'UFRJ-Pantheon', domain: 'pantheon.ufrj.br', handlePrefix: 'UFRJ-PANTHEON', bitstreamPattern: 'standard' },
    { name: 'UFMG', domain: 'repositorio.ufmg.br', handlePrefix: 'UFMG', bitstreamPattern: 'standard' },
    { name: 'UFRGS-LUME', domain: 'lume.ufrgs.br', handlePrefix: 'UFRGS-LUME', bitstreamPattern: 'standard' },
    { name: 'UFSC', domain: 'repositorio.ufsc.br', handlePrefix: 'UFSC', bitstreamPattern: 'standard' },
    { name: 'UNESP', domain: 'repositorio.unesp.br', handlePrefix: 'UNESP', bitstreamPattern: 'standard' },
    { name: 'UnB', domain: 'repositorio.unb.br', handlePrefix: 'UNB', bitstreamPattern: 'standard' },
    { name: 'UFPR', domain: 'acervodigital.ufpr.br', handlePrefix: 'UFPR', bitstreamPattern: 'standard' },
    { name: 'UFBA', domain: 'repositorio.ufba.br', handlePrefix: 'UFBA', bitstreamPattern: 'standard' },
    { name: 'UFRN', domain: 'repositorio.ufrn.br', handlePrefix: 'UFRN', bitstreamPattern: 'standard' },
    { name: 'UFPE', domain: 'repositorio.ufpe.br', handlePrefix: 'UFPE', bitstreamPattern: 'standard' },
    { name: 'UFC', domain: 'repositorio.ufc.br', handlePrefix: 'UFC', bitstreamPattern: 'standard' },
    { name: 'UFPA', domain: 'repositorio.ufpa.br', handlePrefix: 'UFPA', bitstreamPattern: 'standard' },
    { name: 'UFPB', domain: 'repositorio.ufpb.br', handlePrefix: 'UFPB', bitstreamPattern: 'standard' },
    { name: 'UFG', domain: 'repositorio.bc.ufg.br', handlePrefix: 'UFG', bitstreamPattern: 'standard' },
    { name: 'UFES', domain: 'repositorio.ufes.br', handlePrefix: 'UFES', bitstreamPattern: 'standard' },
    { name: 'UFSCar', domain: 'repositorio.ufscar.br', handlePrefix: 'UFSCAR', bitstreamPattern: 'standard' },
    { name: 'UFMS', domain: 'repositorio.ufms.br', handlePrefix: 'UFMS', bitstreamPattern: 'standard' },
    { name: 'UFF-RIUFF', domain: 'app.uff.br', handlePrefix: 'UFF-RIUFF', bitstreamPattern: 'standard' },
    { name: 'UFMA', domain: 'tedebc.ufma.br', handlePrefix: 'UFMA', bitstreamPattern: 'standard' },
    { name: 'UFV', domain: 'locus.ufv.br', handlePrefix: 'UFV', bitstreamPattern: 'standard' },
    { name: 'UFPI', domain: 'repositorio.ufpi.br', handlePrefix: 'UFPI', bitstreamPattern: 'standard' },
    { name: 'UFOP', domain: 'repositorio.ufop.br', handlePrefix: 'UFOP', bitstreamPattern: 'standard' },
    { name: 'FURG', domain: 'repositorio.furg.br', handlePrefix: 'FURG', bitstreamPattern: 'standard' },
    { name: 'UTFPR', domain: 'repositorio.utfpr.edu.br', handlePrefix: 'UTFPR', bitstreamPattern: 'standard' },
    { name: 'UEL', domain: 'repositorio.uel.br', handlePrefix: 'UEL', bitstreamPattern: 'standard' },
    { name: 'PUC-SP', domain: 'repositorio.pucsp.br', handlePrefix: 'PUC-SP', bitstreamPattern: 'standard' },
    { name: 'PUC-RS', domain: 'repositorio.pucrs.br', handlePrefix: 'PUC-RS', bitstreamPattern: 'standard' },
    { name: 'FIOCRUZ-ARCA', domain: 'arca.fiocruz.br', handlePrefix: 'FIOCRUZ-ARCA', bitstreamPattern: 'standard' },
    { name: 'FGV', domain: 'repositorio.fgv.br', handlePrefix: 'FGV', bitstreamPattern: 'standard' },
    // -- ECUADOR (auto-discovered Jul. 2026) --
    { name: 'PUCE', domain: 'repositorio.puce.edu.ec', handlePrefix: 'PUCE', bitstreamPattern: 'standard' },
    { name: 'UPS', domain: 'dspace.ups.edu.ec', handlePrefix: 'UPS', bitstreamPattern: 'standard' },
    // -- PERU (auto-discovered Jul. 2026) --
    { name: 'UPrivadaTacna', domain: 'repositorio.upt.edu.pe', handlePrefix: 'UPRIVADATACNA', bitstreamPattern: 'standard' },
    // -- PERU (auto-discovered Jul. 2026) --
    { name: 'UNAP-Puno', domain: 'repositorio.unap.edu.pe', handlePrefix: 'UNAP-PUNO', bitstreamPattern: 'standard' },
    // -- BRASIL (auto-discovered Jul. 2026) --
    { name: 'UFAM-TEDE', domain: 'tede.ufam.edu.br', handlePrefix: 'UFAM-TEDE', bitstreamPattern: 'standard' },
    { name: 'UNIFESP', domain: 'repositorio.unifesp.br', handlePrefix: 'UNIFESP', bitstreamPattern: 'standard' },
    // -- COLOMBIA (auto-discovered Jul. 2026) --
    { name: 'SciELO-Colombia', domain: 'www.scielo.org.co', handlePrefix: 'SCIELO-COLOMBIA', bitstreamPattern: 'standard' },
    // -- PERU (auto-discovered Jul. 2026) --
    { name: 'UNUcayali', domain: 'repositorio.unu.edu.pe', handlePrefix: 'UNUCAYALI', bitstreamPattern: 'standard' },
];

// â”€â”€â”€ URL Detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Check if a URL is from a known DSpace repository
 */
export function isDSpaceUrl(url: string): DSpaceRepo | null {
    try {
        const parsed = new URL(url);
        const domain = parsed.hostname;
        
        // Check known repos
        const known = PERU_DSPACE_REPOS.find(r => domain.includes(r.domain));
        if (known) return known;
        
        // hdl.handle.net detection: URLs like hdl.handle.net/20.500.12404/12345
        if (domain.includes('hdl.handle.net')) {
            const parts = parsed.pathname.split('/').filter(Boolean);
            if (parts.length >= 2) {
                return {
                    name: `hdl-${parts[0]}`,
                    domain,
                    handlePrefix: parts[0],
                    bitstreamPattern: 'standard',
                };
            }
        }
        
        // Generic DSpace detection: URL contains /handle/ or /bitstream/
        if (url.includes('/handle/') || url.includes('/bitstream/')) {
            return {
                name: domain.split('.')[0],
                domain,
                handlePrefix: '',
                bitstreamPattern: 'standard',
            };
        }
        
        return null;
    } catch {
        return null;
    }
}

// â”€â”€â”€ PDF Link Extraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Extract SciELO PDF URL from an article page HTML.
 * SciELO articles expose a PDF version via:
 *   - meta tag: <meta name="citation_pdf_url" content="...">
 *   - link tag: <a href=".../pdf/..."> or <a href=".../scielo.php?script=sci_pdf&pid=...">
 *   - constructible from the PID: https://www.scielo.org.pe/pdf/<journal>/<vol>/<pid>.pdf
 */
function extractScieloPdfUrl(html: string, pageUrl: string): string | null {
    // 1. citation_pdf_url meta tag (most reliable)
    const metaPdfMatch = html.match(/<meta\s+name=["']citation_pdf_url["']\s+content=["']([^"']+)["']/i);
    if (metaPdfMatch && metaPdfMatch[1]) {
        try {
            const abs = new URL(metaPdfMatch[1], pageUrl).href;
            if (/\.pdf($|\?)/i.test(abs) || /script=sci_pdf/i.test(abs)) return abs;
        } catch { /* ignore */ }
    }

    // 2. Anchor with /pdf/ path or sci_pdf script
    const pdfAnchorRegex = /href\s*=\s*["']([^"']*(?:\/pdf\/|script=sci_pdf)[^"']*)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = pdfAnchorRegex.exec(html)) !== null) {
        try {
            const abs = new URL(m[1], pageUrl).href;
            return abs;
        } catch { /* ignore */ }
    }

    // 3. Construct from PID parameter (scielo.php?script=sci_arttext&pid=S1726-22162012000200006)
    const pidMatch = pageUrl.match(/[?&]pid=([A-Za-z0-9-]+)/);
    if (pidMatch && pidMatch[1]) {
        const pid = pidMatch[1];
        try {
            const parsed = new URL(pageUrl);
            const origin = `${parsed.protocol}//${parsed.host}`;
            // SciELO standard PDF URL pattern: /pdf/<journal>/<vol>/<pid>.pdf
            // PID format: S<issn><yyyylvvvv> -> journal ISSN = pid[1:9], vol = pid[9:13]
            if (/^S\d{8}\d{6}/.test(pid)) {
                const issn = pid.substring(1, 9);
                const vol = pid.substring(9, 13);
                const constructed = `${origin}/pdf/${issn}/${vol}/${pid}.pdf`;
                return constructed;
            }
            // Generic fallback
            return `${origin}/scielo.php?script=sci_pdf&pid=${pid}`;
        } catch { /* ignore */ }
    }

    return null;
}

/**
 * Extract PDF URL from an OJS (Open Journal Systems) article page.
 * OJS exposes PDF via:
 *   - meta tag: <meta name="citation_pdf_url" content="...">
 *   - link: <a href=".../article/download/.../...">
 *
 * OJS URL pattern: /index.php/<journal>/article/view/<id>
 * OJS PDF URL pattern: /index.php/<journal>/article/download/<id>/<galleys>
 */
export function extractOjsPdfUrl(html: string, pageUrl: string): string | null {
    // 1. citation_pdf_url meta tag (most reliable — OJS standard)
    const metaPdfMatch = html.match(/<meta\s+name=["']citation_pdf_url["']\s+content=["']([^"']+)["']/i);
    if (metaPdfMatch && metaPdfMatch[1]) {
        try {
            const abs = new URL(metaPdfMatch[1], pageUrl).href;
            return abs;
        } catch { /* ignore */ }
    }

    // 2. Download link (OJS galley link)
    const downloadMatch = html.match(/href\s*=\s*["']([^"']*\/article\/download\/[^"']+)["']/i);
    if (downloadMatch && downloadMatch[1]) {
        try {
            return new URL(downloadMatch[1], pageUrl).href;
        } catch { /* ignore */ }
    }

    // 3. Construct from view URL → download URL
    // /index.php/<journal>/article/view/12345 → /index.php/<journal>/article/download/12345/1
    const viewMatch = pageUrl.match(/^(.+\/article\/view\/(\d+))/);
    if (viewMatch && viewMatch[1] && viewMatch[2]) {
        return `${viewMatch[1].replace('/view/', '/download/')}/${viewMatch[2]}`;
    }

    return null;
}

/**
 * Check if a URL is an OJS article URL
 */
export function isOjsUrl(url: string): boolean {
    return /\/index\.php\/[^/]+\/article\/(?:view|download)\//.test(url);
}

/**
 * Extract PDF bitstream URL from a DSpace handle page HTML
 * 
 * DSpace pages typically contain links like:
 * - /bitstream/handle/20.500.12404/17080/filename.pdf
 * - /bitstream/20.500.12404/17080/1/filename.pdf
 * - /bitstream/handle/20.500.12404/17080/filename.pdf?sequence=1
 */
function extractBitstreamUrls(html: string, baseUrl: string, repo?: DSpaceRepo | null): string[] {
    // SciELO-specific extraction
    if (repo && repo.bitstreamPattern === 'scielo-pdf') {
        const scieloPdf = extractScieloPdfUrl(html, baseUrl);
        return scieloPdf ? [scieloPdf] : [];
    }

    const urls: string[] = collectDocumentCandidateUrls(html, baseUrl);
    const addUrl = (raw: string) => {
        const clean = sanitizeDocumentUrl(raw, baseUrl);
        if (clean && !urls.includes(clean)) urls.push(clean);
    };
    
    // Pattern 1: Standard DSpace bitstream links
    const bitstreamRegex = /href\s*=\s*["']([^"']*bitstream[^"']*\.pdf[^"']*)["']/gi;
    let match;
    while ((match = bitstreamRegex.exec(html)) !== null) {
        let href = match[1];
        addUrl(href);
    }
    
    // Pattern 2: Generic PDF links on the page
    const pdfRegex = /href\s*=\s*["']([^"']*\.pdf[^"']*)["']/gi;
    while ((match = pdfRegex.exec(html)) !== null) {
        let href = match[1];
        addUrl(href);
    }
    
    // Pattern 3: DSpace REST API bitstream links (newer DSpace versions)
    const restRegex = /href\s*=\s*["']([^"']*\/api\/core\/bitstreams\/[^"']*content[^"']*)["']/gi;
    while ((match = restRegex.exec(html)) !== null) {
        let href = match[1];
        addUrl(href);
    }
    
    // Pattern 4: data-bitstream attribute (Some Mirage/DSpace 5-6 themes)
    const dataBitstreamRegex = /data-bitstream\s*=\s*["']([^"']+)["']/gi;
    while ((match = dataBitstreamRegex.exec(html)) !== null) {
        let href = match[1];
        addUrl(href);
    }

    // Pattern 5: Legacy REST API /rest/items/{id}/bitstreams if somehow exposed
    const legacyRestRegex = /href\s*=\s*["']([^"']*\/rest\/bitstreams\/[^"']+)["']/gi;
    while ((match = legacyRestRegex.exec(html)) !== null) {
        let href = match[1];
        addUrl(href);
    }

    return urls;
}

// â”€â”€â”€ PDF Download â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Attempt to download a PDF from a bitstream URL
 * Returns the PDF buffer if successful, null otherwise
 */
async function downloadBitstream(url: string): Promise<Buffer | null> {
    try {
        console.log(`[DSpace] Downloading: ${url.substring(0, 80)}...`);
        const response = await fetchWithTimeout(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': 'application/pdf,*/*',
                'Referer': new URL(url).origin,
            },
            redirect: 'follow',
        }, 20000);
        
        if (!response.ok) {
            console.warn(`[DSpace] HTTP ${response.status} for ${url.substring(0, 60)}`);
            return null;
        }
        
        const contentType = response.headers.get('content-type') || '';
        const buffer = Buffer.from(await response.arrayBuffer());
        
        // Verify it's actually a PDF
        if (buffer.length < 100) {
            console.warn(`[DSpace] Response too small (${buffer.length} bytes)`);
            return null;
        }
        
        // Check PDF magic bytes
        const header = buffer.subarray(0, 5).toString('ascii');
        if (isLikelyPdfBuffer(buffer)) {
            console.log(`[DSpace] âœ… PDF downloaded: ${(buffer.length / 1024).toFixed(0)}KB`);
            return buffer;
        }
        
        // Some servers return PDF with wrong Content-Type
        if (buffer.length > 10000 && contentType.includes('pdf')) {
            console.log(`[DSpace] âœ… PDF (by content-type): ${(buffer.length / 1024).toFixed(0)}KB`);
            return buffer;
        }
        
        console.warn(`[DSpace] Not a PDF: ${contentType}, header=${header}`);
        return null;
    } catch (e: any) {
        console.warn(`[DSpace] Download error: ${e.message}`);
        return null;
    }
}

// â”€â”€â”€ Main Resolver â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Resolve a DSpace handle URL to a downloadable PDF buffer
 * 
 * Steps:
 * 1. Fetch the handle page HTML
 * 2. Parse out bitstream/PDF links
 * 3. Try downloading each PDF link
 * 4. Return first successful download
 */

/**
 * Resolve a handle page URL to the actual PDF bitstream URL (without downloading).
 * Fetches the handle page, extracts bitstream URLs, returns the first PDF URL.
 * For DSpace 7 (Angular SPA), uses the REST API to find bitstreams.
 */
export async function resolveHandleToPdfUrl(url: string): Promise<string | null> {
    try {
        let resolvedUrl = url;
        // Resolve hdl.handle.net to direct repo URL
        if (url.includes('hdl.handle.net')) {
            const handleMatch = url.match(/hdl\.handle\.net\/([^/?]+\/[^/?]+)/);
            if (handleMatch) {
                const handle = handleMatch[1];
                const repo = PERU_DSPACE_REPOS.find(r => r.handlePrefix === handle.split('/')[0] || r.handlePrefix === handle);
                if (repo) {
                    // Try constructed URL first, but fall back to original hdl.handle.net if it fails
                    const constructedUrl = `https://${repo.domain}/handle/${handle}`;
                    try {
                        const testRes = await fetchWithTimeout(constructedUrl, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } }, 5000);
                        if (testRes.ok || testRes.status === 302 || testRes.status === 301) {
                            resolvedUrl = constructedUrl;
                        } else {
                            resolvedUrl = url; // Fall back to hdl.handle.net (it will redirect)
                        }
                    } catch {
                        resolvedUrl = url; // DNS/timeout — use hdl.handle.net directly
                    }
                } else {
                    // No repo found — use hdl.handle.net as-is (it redirects to the repo)
                    resolvedUrl = url;
                }
            }
        }

        // Don't require repo to be in PERU_DSPACE_REPOS — try fetching directly
        const { html, finalUrl } = await resilientFetch(resolvedUrl, 2, 10000);
        if (!html || html.length < 500) return null;

        // Use finalUrl (after redirect) as base for URL resolution — critical for hdl.handle.net
        // which redirects to the actual repo domain (e.g., hdl.handle.net/20.500.12802/852 → repositorio.uss.edu.pe/handle/...)
        const baseUrl = finalUrl || resolvedUrl;

        // Skip error/login pages (typically 1-5KB HTML with no useful content)
        if (html.length < 5000 && !html.includes('bitstream') && !html.includes('citation_pdf_url') && !html.includes('ds-app') && !html.includes('handle')) {
            return null;
        }

        // Strategy 1: citation_pdf_url meta tag (OJS journals)
        const metaMatch = html.match(/<meta\s+name=["']citation_pdf_url["']\s+content=["']([^"']+)["']/i);
        if (metaMatch && metaMatch[1]) {
            const sanitized = sanitizeRepoUrl(metaMatch[1], baseUrl);
            if (sanitized) return sanitized;
        }

        // Strategy 2: DSpace 7 (Angular SPA) — REST API
        if (html.includes('<ds-app') || html.includes('dspace-angular') || html.includes('<div id="root"></div>') || html.includes('<base href="/"')) {
            let itemUuid: string | null = null;
            const itemMatch = html.match(/items\/([a-f0-9-]{36})/) || baseUrl.match(/items\/([a-f0-9-]{36})/);
            if (itemMatch) {
                itemUuid = itemMatch[1];
            } else {
                const handleMatch = baseUrl.match(/handle\/([^/?]+\/[^/?]+)/);
                if (handleMatch) {
                    const handle = handleMatch[1];
                    const origin = new URL(baseUrl).origin;
                    try {
                        const searchUrl = `${origin}/server/api/core/items/search/findByHandle?handle=${encodeURIComponent(handle)}`;
                        const searchRes = await fetchWithTimeout(searchUrl, { headers: { 'Accept': 'application/json' } }, 8000);
                        if (searchRes.ok) {
                            const itemData: any = await searchRes.json();
                            itemUuid = itemData.uuid || null;
                        }
                    } catch { /* ignore */ }
                }
            }
            if (itemUuid) {
                const origin = new URL(baseUrl).origin;
                const apiUrl = `${origin}/server/api/core/items/${itemUuid}/bitstreams?size=20`;
                const apiRes = await fetchWithTimeout(apiUrl, { headers: { 'Accept': 'application/json' } }, 8000);
                if (apiRes.ok) {
                    const data: any = await apiRes.json();
                    const bitstreams = data._embedded?.bitstreams || [];
                    const pdfBs = bitstreams
                        .filter((b: any) => (b.name || '').toLowerCase().endsWith('.pdf'))
                        .sort((a: any, b: any) => (b.sizeBytes || 0) - (a.sizeBytes || 0));
                    if (pdfBs.length > 0) {
                        return `${origin}/server/api/core/bitstreams/${pdfBs[0].id}/content`;
                    }
                }
            }
        }

        // Strategy 3: DSpace classic — extract bitstream URLs from HTML
        const repo = PERU_DSPACE_REPOS.find(r => baseUrl.includes(r.domain));
        if (repo) {
            const bitstreamUrls = extractBitstreamUrls(html, baseUrl, repo);
            if (bitstreamUrls.length > 0) {
                const sanitized = sanitizeRepoUrl(bitstreamUrls[0], baseUrl);
                if (sanitized) return sanitized;
            }
        }

        // Strategy 4: Generic bitstream/PDF link extraction with localhost sanitization
        const patterns = [
            /href\s*=\s*["']([^"']*\/bitstream\/[^"']+\.pdf[^"']*)["']/gi,
            /href\s*=\s*["']([^"']*\/server\/api\/core\/bitstreams\/[^"']+)["']/gi,
            /href\s*=\s*["']([^"']*\/bitstreams\/[a-f0-9-]+\/download[^"']*)["']/gi,
            /href\s*=\s*["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi,
        ];
        for (const pattern of patterns) {
            let m2: RegExpExecArray | null;
            while ((m2 = pattern.exec(html)) !== null) {
                const sanitized = sanitizeRepoUrl(m2[1], baseUrl);
                if (sanitized) return sanitized;
            }
        }

        return null;
    } catch {
        return null;
    }
}

export async function resolveDSpacePdf(url: string): Promise<{ buffer: Buffer; repo: string } | null> {
    // Resolve hdl.handle.net to direct repo URL using handlePrefix mapping
    let resolvedUrl = url;
    if (url.includes('hdl.handle.net')) {
        const handleMatch = url.match(/hdl\.handle\.net\/([^/?]+\/[^/?]+)/);
        if (handleMatch) {
            const handlePrefix = handleMatch[1].split('/')[0];
            const knownRepo = PERU_DSPACE_REPOS.find(r => r.handlePrefix === handlePrefix);
            if (knownRepo) {
                resolvedUrl = `https://${knownRepo.domain}/handle/${handleMatch[1]}`;
                console.log(`[DSpace] Resolved hdl.handle.net → ${resolvedUrl}`);
            }
        }
    }

    const repo = isDSpaceUrl(resolvedUrl);
    if (!repo) return null;
    
    console.log(`[DSpace] Resolving ${repo.name}: ${resolvedUrl.substring(0, 80)}`);
    
    try {
        // Step 1: Fetch the handle page
        const { html } = await resilientFetch(resolvedUrl, 2, 12000);
        
        if (!html || html.length < 500) {
            console.warn(`[DSpace] Empty or too short response from ${repo.name}`);
            return null;
        }
        
        // Step 1b: DSpace 7 (Angular SPA) — bitstreams are loaded via REST API, not in static HTML
        if (html.includes('<ds-app') || html.includes('dspace-angular') || html.includes('<div id="root"></div>')) {
            let itemUuid: string | null = null;
            const itemMatch = html.match(/items\/([a-f0-9-]{36})/) || resolvedUrl.match(/items\/([a-f0-9-]{36})/);
            if (itemMatch) {
                itemUuid = itemMatch[1];
            } else {
                // Handle format (/handle/prefix/suffix) → resolve to UUID via REST API search
                const handleMatch = resolvedUrl.match(/handle\/([^/?]+\/[^/?]+)/);
                if (handleMatch) {
                    const handle = handleMatch[1];
                    const origin = new URL(resolvedUrl).origin;
                    try {
                        const searchUrl = `${origin}/server/api/core/items/search/findByHandle?handle=${encodeURIComponent(handle)}`;
                        const searchRes = await fetchWithTimeout(searchUrl, { headers: { 'Accept': 'application/json' } }, 8000);
                        if (searchRes.ok) {
                            const itemData: any = await searchRes.json();
                            itemUuid = itemData.uuid || null;
                            if (itemUuid) console.log(`[DSpace] Resolved handle ${handle} → UUID ${itemUuid}`);
                        }
                    } catch (e: any) { console.warn(`[DSpace] Handle→UUID resolution failed: ${e.message}`); }
                }
            }
            const origin = new URL(resolvedUrl).origin;
            if (itemUuid) {
                const apiUrl = `${origin}/server/api/core/items/${itemUuid}/bitstreams?size=20`;
                console.log(`[DSpace] DSpace 7 detected, trying REST API: ${apiUrl.substring(0, 70)}`);
                try {
                    const apiRes = await fetchWithTimeout(apiUrl, { headers: { 'Accept': 'application/json' } }, 10000);
                    if (apiRes.ok) {
                        const data: any = await apiRes.json();
                        const bitstreams = data._embedded?.bitstreams || [];
                        const pdfBitstreams = bitstreams
                            .filter((b: any) => (b.name || '').toLowerCase().endsWith('.pdf'))
                            .sort((a: any, b: any) => (b.sizeBytes || 0) - (a.sizeBytes || 0));
                        for (const bs of pdfBitstreams.slice(0, 3)) {
                            const dlUrl = `${origin}/server/api/core/bitstreams/${bs.id}/content`;
                            const buffer = await downloadBitstream(dlUrl);
                            if (buffer) return { buffer, repo: repo.name };
                        }
                    }
                } catch (e: any) { console.warn(`[DSpace] REST API failed: ${e.message}`); }
            }
            // Fall through to extractBitstreamUrls as fallback
        }
        
        // Step 2: Extract bitstream URLs from HTML (DSpace clásico or REST API fallback)
        const bitstreamUrls = extractBitstreamUrls(html, resolvedUrl, repo);
        
        if (bitstreamUrls.length === 0) {
            console.warn(`[DSpace] No PDF links found on ${repo.name} page`);
            
            // Try constructing bitstream URL from handle
            const handleMatch = resolvedUrl.match(/handle\/([^/?]+\/[^/?]+)/);
            if (handleMatch) {
                const handleId = handleMatch[1];
                const parsed = new URL(resolvedUrl);
                const constructedUrl = `${parsed.protocol}//${parsed.host}/bitstream/handle/${handleId}/1/Tesis.pdf`;
                console.log(`[DSpace] Trying constructed URL: ${constructedUrl}`);
                bitstreamUrls.push(constructedUrl);
            }
        }
        
        console.log(`[DSpace] Found ${bitstreamUrls.length} potential PDF links from ${repo.name}`);
        
        // Step 3: Try downloading each PDF
        for (const pdfUrl of bitstreamUrls.slice(0, 5)) {
            const buffer = await downloadBitstream(pdfUrl);
            if (buffer) {
                return { buffer, repo: repo.name };
            }
        }
        
        console.warn(`[DSpace] All ${bitstreamUrls.length} download attempts failed for ${resolvedUrl}`);
        return null;
        
    } catch (e: any) {
        console.warn(`[DSpace] Resolution error for ${resolvedUrl}: ${e.message}`);
        return null;
    }
}

/**
 * Check if a URL matches any known Peruvian DSpace repository
 */
export function isPeruDSpaceUrl(url: string): boolean {
    // Flexible matching: extract hostname and check if it matches any Peru repo domain
    // This handles subdomain variants like repositorio.pucp.edu.pe vs tesis.pucp.edu.pe
    try {
        const hostname = new URL(url).hostname;
        // Direct match
        if (PERU_DSPACE_REPOS.some(r => hostname === r.domain || hostname.endsWith('.' + r.domain))) return true;
        // Flexible: match by university name keyword in hostname (e.g., pucp, unsa, ucv)
        const repoKeywords = PERU_DSPACE_REPOS.map(r => r.domain.split('.')[0]);
        // Also check if the URL contains /handle/ or /bitstream/ (DSpace pattern) and .edu.pe or .gob.pe
        if ((url.includes('.edu.pe') || url.includes('.gob.pe')) &&
            (url.includes('/handle/') || url.includes('/bitstream/') || url.includes('/server/api/'))) {
            return true;
        }
        return false;
    } catch {
        return PERU_DSPACE_REPOS.some(r => url.includes(r.domain));
    }
}

/**
 * List all known Peruvian DSpace repositories
 */
export function listPeruRepos(): { name: string; domain: string }[] {
    return PERU_DSPACE_REPOS.map(r => ({ name: r.name, domain: r.domain }));
}
