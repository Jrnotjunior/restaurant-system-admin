import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from './lib/supabase';

function App() {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [signedIn,setSignedIn]=useState(false);
  const [authorized,setAuthorized]=useState(false);
  const [loading,setLoading]=useState(true);

  useEffect(() => {
    let active=true;
    supabase.auth.getSession().then(({data}) => {
      if(active){setSignedIn(Boolean(data.session));setLoading(false);}
    });
    const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{
      const hasSession=Boolean(session);
      setSignedIn(hasSession);
      if (!hasSession) {
        setAuthorized(false);
      }
    });
    return ()=>{active=false;listener.subscription.unsubscribe();};
  },[]);

  async function signIn(event:FormEvent){
    event.preventDefault();
    const {error}=await supabase.auth.signInWithPassword({email,password});
    if(error) {
      window.alert(error.message);
      return;
    }
    const { data: adminStatus, error: adminError } = await supabase.rpc('get_my_system_admin_status');
    if (adminError) {
      await supabase.auth.signOut();
    setAuthorized(false);
      window.alert(adminError.message);
      return;
    }
    if (adminStatus !== true) {
      await supabase.auth.signOut();
      setSignedIn(false);
      setAuthorized(false);
      window.alert('This account is not authorized as a System Administrator.');
      return;
    }
    setAuthorized(true);
  }

  async function signOut(){ await supabase.auth.signOut(); }

  if(loading) return <main className="screen-center">Loading...</main>;

  if(!signedIn) return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">Restaurant Platform</div>
        <h1>System Admin</h1>
        <p>Sign in to manage restaurants and platform settings.</p>
        <form onSubmit={signIn}>
          <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required /></label>
          <button type="submit">Sign in</button>
        </form>
      </section>
    </main>
  );

  if (!authorized) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="eyebrow">Restaurant Platform</div>
          <h1>Access denied</h1>
          <p>Your account is signed in but is not authorized as a System Administrator.</p>
          <button onClick={signOut}>Sign out</button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><div className="eyebrow">Restaurant Platform</div><h1>System Admin</h1></div>
        <button className="secondary-button" onClick={signOut}>Sign out</button>
      </header>
      <section className="dashboard-card">
        <h2>Dashboard</h2>
        <p>You are signed in. System Admin authorization will be enforced through Supabase before platform management features are enabled.</p>
      </section>
    </main>
  );
}
export default App;