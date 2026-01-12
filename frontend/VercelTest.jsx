function VercelTest(){
    return(
        <div style={{ padding:'40px'}}>
            <h1>Vercel Deploy Test Page</h1>
            <p>テスト用のページです。</p>
            <p>Build time: {new Date().toLocaleString()}</p>
            <p>Mode: {import.meta.env.MODE}</p>
        </div>
    );
}

export default VercelTest;