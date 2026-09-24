import AppRouter from './router/AppRouter.jsx';
import NavBar from './components/NavBar.jsx';

function App() {
  return (
    <>
      <NavBar />
      <main>
        <AppRouter />
      </main>
    </>
  );
}

export default App;
