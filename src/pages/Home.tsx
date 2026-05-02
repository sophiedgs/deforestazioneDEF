import { useState } from "react";
import HeaderHome from "../components/HeaderHome";
import CatastoMenu from "../components/CatastoMenu";
import ItaliaMap from "../components/ItaliaMap";
import "../styles/home.css";
import type { RicercaMappa, RicercaParticella } from "../components/Utils";


function Home() {
  const [ricercaMappa, setRicercaMappa] = useState<RicercaMappa | null>(null);
  const [ricercaParticella, setRicercaParticella] = useState<RicercaParticella | null>(null);
  const [resetMappaCount, setResetMappaCount] = useState(0);
  const [resetParticellaCount, setResetParticellaCount] = useState(0);

  const [menuRicercaVisibile, setMenuRicercaVisibile] = useState(true);

  return (
    <main className="homeBackground">
      <section className={`homeCard ${menuRicercaVisibile ? "" : "homeCardMenuChiuso"}`}>
        {menuRicercaVisibile && (
          <div className="homeLeft">
            <HeaderHome title="Ricerca catastale" subtitle="Cerca mappe e particelle nel Veneto"
            />
            <CatastoMenu  onSearchMappa={setRicercaMappa} onSearchParticella={setRicercaParticella}
              onResetMappa={() => {
                setRicercaMappa(null);
                setResetMappaCount((v) => v + 1);
              }}
              onResetParticella={() => {
                setRicercaParticella(null);
                setResetParticellaCount((v) => v + 1);
              }}
            />
          </div>
        )}

        <div className="homeRight">
          <div className="previewBox">
            <ItaliaMap
              ricercaMappa={ricercaMappa}
              ricercaParticella={ricercaParticella}
              resetMappaCount={resetMappaCount}
              resetParticellaCount={resetParticellaCount}
              menuRicercaVisibile={menuRicercaVisibile}
              onChiudiMenuRicerca={() => setMenuRicercaVisibile(false)}
              onApriMenuRicerca={() => setMenuRicercaVisibile(true)}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;