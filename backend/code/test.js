import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient("http://localhost:8000", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5ZXRkb2diaGxlbmFld3Zub256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMjkyNDcsImV4cCI6MjA4MzcwNTI0N30.tjXJ5L2d7LwUiKN8lniggSWUbj13nxCSa3jIF2IM614");

function App() {
  const [shops, setShops] = useState([]);
  const [books, setBooks] = useState([]);
  const [shopsJoinBooks, setShopsJoinBooks] = useState([]);

  useEffect(() => {
    getShops();
    getBooks();
    getShopsJoinBooks();
  }, []);

  async function getShops() {
    const { data } = await supabase.from("shops").select();
    setShops(data);
  }

  async function getBooks() {
    const { data } = await supabase.from("books").select();
    setBooks(data);
  }

  async function getShopsJoinBooks() {
    const { data } = await supabase.from('shops')
    .select(`
      id, name,
      books (
        id, name
      )
    `);
    setShopsJoinBooks(data);
  }

  return (
    <>
      <ul>
        {shops.map((shop) => (
          <li key={shop.id}>{shop.name}</li>
        ))}
      </ul>

      <ul>
        {books.map((book) => (
          <li key={book.id}>{book.name}</li>
        ))}
      </ul>

      <ul>
        {shopsJoinBooks.map((shop) => (
          <li key={shop.id}>
            <h3>{shop.name}</h3>
            <ul>
              {shop.books.map((book) => (
                <li key={book.id}>{book.name}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

    </>
  );
}

export default App;
