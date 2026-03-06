export default function StoreCard({store}){
  return (
    <article className="store-card card">
      <div className="store-head">
        <div className="store-logo">{store.name.charAt(0)}</div>
        <div>
          <div className="store-name">{store.name}</div>
          <div className="store-tag muted">{store.tagline}</div>
        </div>
      </div>

      <div className="store-thumbs">
        {store.thumbs.map((t,i)=> (
          <img key={i} src={'/placeholder.png'} alt="thumb" />
        ))}
      </div>
    </article>
  )
}
