interface HeaderHomeProps {
  title: string;
  subtitle: string;
}

function HeaderHome({ title, subtitle }: Readonly<HeaderHomeProps>) {
  return (
    <div>
      <h1 className="homeTitle">{title}</h1>
      <p className="homeSubtitle">{subtitle}</p>
    </div>
  );
}

export default HeaderHome;
