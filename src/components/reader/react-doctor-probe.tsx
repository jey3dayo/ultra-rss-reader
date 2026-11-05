import { useEffect, useState } from "react";

export function ReactDoctorProbe({ items }: { items: string[] }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(items.length);
  }, [items]);
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>
          {item} {count}
        </li>
      ))}
    </ul>
  );
}
