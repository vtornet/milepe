import AppRouter from './router/AppRouter.jsx';
import NavBar from './components/NavBar.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

function App() {
  return (
    <AuthProvider>
      <NavBar />
      <main>
        <AppRouter />
      </main>
    </AuthProvider>
  );
}

export default App;
