import { useId } from 'react';

/** A glossary word with its definition on hover or keyboard focus. */
export default function GlossaryTerm({ text, definition, term }) {
  const id = useId();
  return (
    <span className="term-wrap">
      <button type="button" className="term" aria-describedby={id}>{text}</button>
      <span role="tooltip" id={id} className="term-tip">
        <strong>{term}.</strong> {definition}
      </span>
    </span>
  );
}
