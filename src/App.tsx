import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import CatastoMenu from "./components/CatastoMenu";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/item/:id" element={<CatastoMenu />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;